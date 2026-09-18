import {
  calculatePaymentDistribution,
  calculateRemainingBalance,
  type InstallmentBalance,
  isInstallmentPaid,
  resolveInstallmentStatus,
  resolveLoanStatus,
  toDbString,
  toDecimal,
} from "@/lib/calculations";
import { fromIsoDate, toIsoDate, todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { PaymentInput } from "@/lib/validations/payment";

import { NotFoundError, ServiceError } from "../errors";

const SERIALIZATION_FAILURE = "P2034";
const MAX_ATTEMPTS = 3;

export type RegisterPaymentResult = {
  paymentId: string;
  interestPaid: number;
  principalPaid: number;
  loanStatus: "ACTIVE" | "PAID" | "OVERDUE" | "CANCELLED";
};

/**
 * Registers a payment against a loan. Everything — validation against the live
 * balance, interest/principal split, installment and loan status updates — runs
 * inside one serializable transaction so a failure leaves no partial state.
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

async function applyPayment(input: PaymentInput): Promise<RegisterPaymentResult> {
  return prisma.$transaction(
    async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: input.loanId },
        include: { installments: { orderBy: { installmentNumber: "asc" } } },
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

      const balances: InstallmentBalance[] = loan.installments.map((i) => ({
        id: i.id,
        installmentNumber: i.installmentNumber,
        principalAmount: i.principalAmount,
        principalPaid: i.principalPaid,
        interestAmount: i.interestAmount,
        interestPaid: i.interestPaid,
      }));

      const remaining = calculateRemainingBalance(balances);
      const amount = toDecimal(input.amount);
      if (amount.gt(remaining.total)) {
        const message = `El pago supera el saldo pendiente (${formatMoney(remaining.total.toNumber())})`;
        throw new ServiceError(message, { amount: [message] });
      }

      const distribution = calculatePaymentDistribution(balances, amount, input.installmentId);
      if (distribution.unallocated.gt(0)) {
        const message = "El pago supera lo pendiente desde la cuota seleccionada";
        throw new ServiceError(message, { amount: [message] });
      }

      const payment = await tx.payment.create({
        data: {
          loanId: loan.id,
          installmentId: input.installmentId,
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

      for (const allocation of distribution.allocations) {
        const current = loan.installments.find((i) => i.id === allocation.installmentId);
        if (!current) continue;

        const principalPaid = toDecimal(current.principalPaid).plus(allocation.principalPaid);
        const interestPaid = toDecimal(current.interestPaid).plus(allocation.interestPaid);
        const paidAmount = principalPaid.plus(interestPaid);
        const status = resolveInstallmentStatus(
          { totalAmount: current.totalAmount, paidAmount, dueDate: toIsoDate(current.dueDate) },
          today,
        );

        await tx.installment.update({
          where: { id: current.id },
          data: {
            principalPaid: toDbString(principalPaid),
            interestPaid: toDbString(interestPaid),
            paidAmount: toDbString(paidAmount),
            status,
            paidAt: status === "PAID" ? fromIsoDate(input.paymentDate) : null,
          },
        });
        statuses.set(current.id, status);
      }

      const loanStatus = resolveLoanStatus([...statuses.values()], loan.status);
      if (loanStatus !== loan.status) {
        await tx.loan.update({ where: { id: loan.id }, data: { status: loanStatus } });
      }

      return {
        paymentId: payment.id,
        interestPaid: distribution.interestPaid.toNumber(),
        principalPaid: distribution.principalPaid.toNumber(),
        loanStatus,
      };
    },
    { isolationLevel: "Serializable" },
  );
}
