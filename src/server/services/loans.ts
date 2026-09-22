import {
  calculateLoanDueDate,
  generateSchedule,
  toDbString,
} from "@/lib/calculations";
import { fromIsoDate, type IsoDate, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { LoanInput } from "@/lib/validations/loan";

import { NotFoundError, ServiceError } from "../errors";
import { assertCashBoxUsable, assertSufficientBalance, recordLoanDisbursement, recordLoanReversal } from "./cash-boxes";

/**
 * Creates a loan together with its full installment schedule in one atomic write.
 * The schedule is produced by `lib/calculations`; nothing here does money math.
 */
export async function createLoan(input: LoanInput) {
  const person = await prisma.person.findUnique({
    where: { id: input.personId },
    select: { id: true, name: true, active: true },
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

  // The money leaves a box, so the loan and its disbursement are written together.
  return prisma.$transaction(async (tx) => {
    const cashBox = await assertCashBoxUsable(tx, input.cashBoxId);
    await assertSufficientBalance(tx, cashBox.id, input.principalAmount, "principalAmount");

    const loan = await tx.loan.create({
      data: {
        personId: person.id,
        cashBoxId: cashBox.id,
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

    await recordLoanDisbursement(tx, {
      cashBoxId: cashBox.id,
      loanId: loan.id,
      amount: input.principalAmount,
      movementDate: input.startDate,
      personName: person.name,
    });

    return loan;
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
  await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        status: true,
        cashBoxId: true,
        principalAmount: true,
        person: { select: { name: true } },
        _count: { select: { payments: true } },
      },
    });
    if (!loan) throw new NotFoundError("El préstamo");
    if (loan.status === "CANCELLED") throw new ServiceError("El préstamo ya está cancelado");
    if (loan.status === "PAID") throw new ServiceError("No se puede cancelar un préstamo pagado");
    if (loan._count.payments > 0) {
      throw new ServiceError("No se puede cancelar un préstamo que ya tiene pagos registrados");
    }

    await tx.loan.update({ where: { id: loanId }, data: { status: "CANCELLED" } });

    // Cancelling requires a loan without payments, so the whole capital goes back.
    if (loan.cashBoxId) {
      await recordLoanReversal(tx, {
        cashBoxId: loan.cashBoxId,
        loanId: loan.id,
        amount: loan.principalAmount,
        personName: loan.person.name,
        reason: "CANCELLED",
      });
    }
  });
}

export async function deleteLoan(loanId: string) {
  await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        status: true,
        cashBoxId: true,
        principalAmount: true,
        person: { select: { name: true } },
        _count: { select: { payments: true } },
      },
    });
    if (!loan) throw new NotFoundError("El préstamo");
    if (loan._count.payments > 0) {
      throw new ServiceError("No se puede eliminar un préstamo con pagos registrados");
    }

    if (loan.cashBoxId && loan.status !== "CANCELLED") {
      await recordLoanReversal(tx, {
        cashBoxId: loan.cashBoxId,
        loanId: null,
        amount: loan.principalAmount,
        personName: loan.person.name,
        reason: "DELETED",
      });
    }

    await tx.loan.delete({ where: { id: loanId } });
  });
}
