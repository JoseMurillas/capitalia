import "server-only";

import { sumMoney, toDecimal, toNumber } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";

export type CashPosition = {
  totalIncome: number;
  totalExpense: number;
  totalDisbursed: number;
  totalCollected: number;
  /** Income − expenses − capital lent out + payments received. */
  available: number;
};

/**
 * Cash on hand as the administrator sees it: personal income minus expenses,
 * minus the capital handed out in loans, plus every payment received back.
 * Loan flows are derived from Loan/Payment rather than mirrored as
 * transactions, so nothing is counted twice.
 */
export async function getCashPosition(): Promise<CashPosition> {
  const [income, expense, disbursed, collected] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: "INCOME" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "EXPENSE" }, _sum: { amount: true } }),
    prisma.loan.aggregate({ where: { status: { not: "CANCELLED" } }, _sum: { principalAmount: true } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
  ]);

  const totalIncome = toDecimal(income._sum.amount ?? 0);
  const totalExpense = toDecimal(expense._sum.amount ?? 0);
  const totalDisbursed = toDecimal(disbursed._sum.principalAmount ?? 0);
  const totalCollected = toDecimal(collected._sum.amount ?? 0);

  return {
    totalIncome: toNumber(totalIncome),
    totalExpense: toNumber(totalExpense),
    totalDisbursed: toNumber(totalDisbursed),
    totalCollected: toNumber(totalCollected),
    available: toNumber(
      sumMoney([totalIncome, totalCollected]).minus(totalExpense).minus(totalDisbursed),
    ),
  };
}
