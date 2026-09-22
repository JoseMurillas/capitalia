import { Prisma } from "@/generated/prisma/client";
import {
  calculateInterestOnlyDistribution,
  calculatePaymentDistribution,
  calculatePrincipalPrepayment,
  calculateRemainingBalance,
  type InstallmentBalance,
  isInstallmentPaid,
  type PaymentDistribution,
  resolveInstallmentStatus,
  resolveLoanStatus,
  toDbString,
  toDecimal,
  ZERO,
} from "@/lib/calculations";
import { fromIsoDate, toIsoDate, todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { PaymentInput } from "@/lib/validations/payment";

import { NotFoundError, ServiceError } from "../errors";
import { recordLoanPayment } from "./cash-boxes";

const SERIALIZATION_FAILURE = "P2034";
const MAX_ATTEMPTS = 3;

export type RegisterPaymentResult = {
  paymentId: string;
  kind: PaymentInput["kind"];
  interestPaid: number;
  principalPaid: number;
  loanStatus: "ACTIVE" | "PAID" | "OVERDUE" | "CANCELLED";
};

type LoanWithInstallments = Prisma.LoanGetPayload<{ include: { installments: true } }>;
type InstallmentRow = LoanWithInstallments["installments"][number];

/** New figures for one installment after a payment is applied. */
type InstallmentUpdate = {
  id: string;
  principalAmount: ReturnType<typeof toDecimal>;
  interestAmount: ReturnType<typeof toDecimal>;
  principalPaid: ReturnType<typeof toDecimal>;
  interestPaid: ReturnType<typeof toDecimal>;
};

/**
 * Registers a payment against a loan. Everything — validation against the live
 * balance, the split between interest and principal, installment and loan
 * status updates — runs inside one serializable transaction so a failure
 * leaves no partial state.
 */
export async function registerPayment(input: PaymentInput): Promise<RegisterPaymentResult> {
  // Serializable transactions can be aborted when two payments race; retrying
  // re-reads the balance so the second one is validated against the first.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await applyPayment(input);
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === SERIALIZATION_FAILURE &&
        attempt < MAX_ATTEMPTS;
      if (!retryable) throw error;
    }
  }
}

function toBalances(installments: InstallmentRow[]): InstallmentBalance[] {
  return installments.map((i) => ({
    id: i.id,
    installmentNumber: i.installmentNumber,
    principalAmount: i.principalAmount,
    principalPaid: i.principalPaid,
    interestAmount: i.interestAmount,
    interestPaid: i.interestPaid,
  }));
}

function amountError(message: string): ServiceError {
  return new ServiceError(message, { amount: [message] });
}

/** AUTO and INTEREST_ONLY only move paid amounts; the schedule itself is untouched. */
function applyDistribution(installments: InstallmentRow[], distribution: PaymentDistribution): InstallmentUpdate[] {
  return distribution.allocations.flatMap((allocation) => {
    const current = installments.find((i) => i.id === allocation.installmentId);
    if (!current) return [];
    return [
      {
        id: current.id,
        principalAmount: toDecimal(current.principalAmount),
        interestAmount: toDecimal(current.interestAmount),
        principalPaid: toDecimal(current.principalPaid).plus(allocation.principalPaid),
        interestPaid: toDecimal(current.interestPaid).plus(allocation.interestPaid),
      },
    ];
  });
}

function planPayment(loan: LoanWithInstallments, input: PaymentInput) {
  const amount = toDecimal(input.amount);
  const balances = toBalances(loan.installments);
  const remaining = calculateRemainingBalance(balances);

  switch (input.kind) {
    case "AUTO": {
      if (amount.gt(remaining.total)) {
        throw amountError(`El pago supera el saldo pendiente (${formatMoney(remaining.total.toNumber())})`);
      }
      const distribution = calculatePaymentDistribution(balances, amount, input.installmentId);
      if (distribution.unallocated.gt(0)) {
        throw amountError("El pago supera lo pendiente desde la cuota seleccionada");
      }
      return { distribution, updates: applyDistribution(loan.installments, distribution) };
    }
    case "INTEREST_ONLY": {
      if (remaining.interest.lte(0)) {
        throw amountError("Este préstamo no tiene intereses pendientes");
      }
      if (amount.gt(remaining.interest)) {
        throw amountError(`El pago supera los intereses pendientes (${formatMoney(remaining.interest.toNumber())})`);
      }
      const distribution = calculateInterestOnlyDistribution(balances, amount, input.installmentId);
      if (distribution.unallocated.gt(0)) {
        throw amountError("El pago supera los intereses pendientes desde la cuota seleccionada");
      }
      return { distribution, updates: applyDistribution(loan.installments, distribution) };
    }
    case "PRINCIPAL": {
      if (remaining.principal.lte(0)) {
        throw amountError("Este préstamo no tiene capital pendiente");
      }
      if (amount.gt(remaining.principal)) {
        throw amountError(`El abono supera el capital pendiente (${formatMoney(remaining.principal.toNumber())})`);
      }
      const prepayment = calculatePrincipalPrepayment(
        loan.installments.map((i) => ({
          id: i.id,
          installmentNumber: i.installmentNumber,
          principalAmount: i.principalAmount,
          principalPaid: i.principalPaid,
          interestAmount: i.interestAmount,
          interestPaid: i.interestPaid,
          status: i.status,
        })),
        amount,
        {
          monthlyInterestRate: loan.monthlyInterestRate,
          installmentFrequency: loan.installmentFrequency,
          customIntervalDays: loan.customIntervalDays,
        },
      );
      const distribution: PaymentDistribution = {
        allocations: prepayment.allocations,
        principalPaid: prepayment.principalPaid,
        interestPaid: ZERO,
        unallocated: ZERO,
      };
      return {
        distribution,
        updates: prepayment.installments.map((i) => ({
          id: i.id,
          principalAmount: i.principalAmount,
          interestAmount: i.interestAmount,
          principalPaid: i.principalPaid,
          interestPaid: i.interestPaid,
        })),
      };
    }
  }
}

async function applyPayment(input: PaymentInput): Promise<RegisterPaymentResult> {
  return prisma.$transaction(
    async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: input.loanId },
        include: {
          installments: { orderBy: { installmentNumber: "asc" } },
          person: { select: { name: true } },
        },
      });
      if (!loan) throw new NotFoundError("El préstamo");
      if (loan.status === "CANCELLED") {
        throw new ServiceError("No se pueden registrar pagos en un préstamo cancelado");
      }
      if (loan.status === "PAID") {
        throw new ServiceError("El préstamo ya está completamente pagado");
      }

      if (input.installmentId) {
        const target = loan.installments.find((i) => i.id === input.installmentId);
        if (!target) {
          throw new ServiceError("La cuota no pertenece a este préstamo", {
            installmentId: ["Cuota inválida"],
          });
        }
        if (isInstallmentPaid(target)) {
          throw new ServiceError("La cuota seleccionada ya está pagada", {
            installmentId: ["Cuota ya pagada"],
          });
        }
      }

      const { distribution, updates } = planPayment(loan, input);
      const amount = toDecimal(input.amount);

      const payment = await tx.payment.create({
        data: {
          loanId: loan.id,
          installmentId: input.installmentId,
          kind: input.kind,
          amount: toDbString(amount),
          principalPaid: toDbString(distribution.principalPaid),
          interestPaid: toDbString(distribution.interestPaid),
          paymentDate: fromIsoDate(input.paymentDate),
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          allocations: {
            create: distribution.allocations.map((a) => ({
              installmentId: a.installmentId,
              principalPaid: toDbString(a.principalPaid),
              interestPaid: toDbString(a.interestPaid),
            })),
          },
        },
        select: { id: true },
      });

      const today = todayIso();
      const statuses = new Map(loan.installments.map((i) => [i.id, i.status]));

      for (const update of updates) {
        const current = loan.installments.find((i) => i.id === update.id);
        if (!current) continue;

        const totalAmount = update.principalAmount.plus(update.interestAmount);
        const paidAmount = update.principalPaid.plus(update.interestPaid);
        const status = resolveInstallmentStatus(
          { totalAmount, paidAmount, dueDate: toIsoDate(current.dueDate) },
          today,
        );

        await tx.installment.update({
          where: { id: current.id },
          data: {
            principalAmount: toDbString(update.principalAmount),
            interestAmount: toDbString(update.interestAmount),
            totalAmount: toDbString(totalAmount),
            principalPaid: toDbString(update.principalPaid),
            interestPaid: toDbString(update.interestPaid),
            paidAmount: toDbString(paidAmount),
            status,
            paidAt: status === "PAID" ? (current.paidAt ?? fromIsoDate(input.paymentDate)) : null,
          },
        });
        statuses.set(current.id, status);
      }

      const loanStatus = resolveLoanStatus([...statuses.values()], loan.status);
      if (loanStatus !== loan.status) {
        await tx.loan.update({ where: { id: loan.id }, data: { status: loanStatus } });
      }

      // The money comes back to the box the loan was funded from: capital and interest.
      if (loan.cashBoxId) {
        await recordLoanPayment(tx, {
          cashBoxId: loan.cashBoxId,
          loanId: loan.id,
          paymentId: payment.id,
          amount: input.amount,
          movementDate: input.paymentDate,
          personName: loan.person.name,
        });
      }

      return {
        paymentId: payment.id,
        kind: input.kind,
        interestPaid: distribution.interestPaid.toNumber(),
        principalPaid: distribution.principalPaid.toNumber(),
        loanStatus,
      };
    },
    { isolationLevel: "Serializable" },
  );
}
