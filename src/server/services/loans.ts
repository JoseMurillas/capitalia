import {
  calculateLoanDueDate,
  generateSchedule,
  toDbString,
} from "@/lib/calculations";
import { fromIsoDate, type IsoDate, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { LoanInput } from "@/lib/validations/loan";

import { NotFoundError, ServiceError } from "../errors";

/**
 * Creates a loan together with its full installment schedule in one atomic write.
 * The schedule is produced by `lib/calculations`; nothing here does money math.
 */
export async function createLoan(input: LoanInput) {
  const person = await prisma.person.findUnique({
    where: { id: input.personId },
    select: { id: true, active: true },
  });
  if (!person) {
    throw new ServiceError("La persona seleccionada no existe", {
      personId: ["La persona seleccionada no existe"],
    });
  }
  if (!person.active) {
    throw new ServiceError("La persona está inactiva; actívala antes de prestarle", {
      personId: ["Persona inactiva"],
    });
  }

  const scheduleParams = {
    principalAmount: input.principalAmount,
    monthlyInterestRate: input.monthlyInterestRate,
    interestType: input.interestType,
    numberOfInstallments: input.numberOfInstallments,
    installmentFrequency: input.installmentFrequency,
    customIntervalDays: input.customIntervalDays,
    startDate: input.startDate,
  };
  const schedule = generateSchedule(scheduleParams);
  const lastDueDate = calculateLoanDueDate(scheduleParams);

  const dueDate = input.dueDate ?? lastDueDate;
  if (dueDate < lastDueDate) {
    throw new ServiceError(
      "La fecha de vencimiento no puede ser anterior a la última cuota",
      { dueDate: [`La última cuota vence el ${lastDueDate}`] },
    );
  }

  return prisma.loan.create({
    data: {
      personId: person.id,
      principalAmount: toDbString(input.principalAmount),
      monthlyInterestRate: input.monthlyInterestRate.toFixed(3),
      interestType: input.interestType,
      numberOfInstallments: input.numberOfInstallments,
      installmentFrequency: input.installmentFrequency,
      customIntervalDays:
        input.installmentFrequency === "CUSTOM" ? input.customIntervalDays : null,
      startDate: fromIsoDate(input.startDate),
      dueDate: fromIsoDate(dueDate),
      notes: input.notes,
      installments: {
        create: schedule.map((i) => ({
          installmentNumber: i.installmentNumber,
          dueDate: fromIsoDate(i.dueDate),
          principalAmount: toDbString(i.principalAmount),
          interestAmount: toDbString(i.interestAmount),
          totalAmount: toDbString(i.totalAmount),
        })),
      },
    },
    select: { id: true },
  });
}

/**
 * Marks past-due installments and their loans as OVERDUE. Idempotent and cheap,
 * so read paths call it instead of relying on a scheduler.
 */
export async function syncOverdueStatuses(today: IsoDate = todayIso()) {
  const cutoff = fromIsoDate(today);
  await prisma.$transaction([
    prisma.installment.updateMany({
      where: { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: cutoff } },
      data: { status: "OVERDUE" },
    }),
    prisma.loan.updateMany({
      where: { status: "ACTIVE", installments: { some: { status: "OVERDUE" } } },
      data: { status: "OVERDUE" },
    }),
  ]);
}

export async function updateLoanNotes(loanId: string, notes: string | null) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId }, select: { id: true } });
  if (!loan) throw new NotFoundError("El préstamo");
  await prisma.loan.update({ where: { id: loanId }, data: { notes } });
}

export async function cancelLoan(loanId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { id: true, status: true, _count: { select: { payments: true } } },
  });
  if (!loan) throw new NotFoundError("El préstamo");
  if (loan.status === "CANCELLED") throw new ServiceError("El préstamo ya está cancelado");
  if (loan.status === "PAID") throw new ServiceError("No se puede cancelar un préstamo pagado");
  if (loan._count.payments > 0) {
    throw new ServiceError("No se puede cancelar un préstamo que ya tiene pagos registrados");
  }
  await prisma.loan.update({ where: { id: loanId }, data: { status: "CANCELLED" } });
}

export async function deleteLoan(loanId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { id: true, _count: { select: { payments: true } } },
  });
  if (!loan) throw new NotFoundError("El préstamo");
  if (loan._count.payments > 0) {
    throw new ServiceError("No se puede eliminar un préstamo con pagos; cancélalo en su lugar");
  }
  await prisma.loan.delete({ where: { id: loanId } });
}
