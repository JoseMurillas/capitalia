import "server-only";

import { cashBoxBalance, outstandingPrincipal, sumMoney, toDecimal, toNumber } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";

export type CashPosition = {
  totalIncome: number;
  totalExpense: number;
  /** Capital moved from personal cash into the boxes. */
  depositsFromPersonal: number;
  /** Capital taken out of the boxes back into personal cash. */
  withdrawalsToPersonal: number;
  /** Personal cash on hand. Loan flows live in the cash boxes, not here. */
  available: number;
  /** Idle capital across the active boxes. */
  cashBoxesAvailable: number;
  /** Capital currently out in loans. */
  lentOut: number;
  /** available + cashBoxesAvailable + lentOut. */
  netWorth: number;
};

/**
 * Two pockets: personal cash (income minus expenses, minus what was moved into
 * the cash boxes) and the cash boxes themselves. A credit-card limit or a box's
 * capital is never counted as personal money.
 */
export async function getCashPosition(): Promise<CashPosition> {
  const [income, expense, deposits, withdrawals, boxes, loans] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: "INCOME" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "EXPENSE" }, _sum: { amount: true } }),
    prisma.cashBoxMovement.aggregate({
      where: { kind: "DEPOSIT", counterparty: "PERSONAL_FINANCES" },
      _sum: { amount: true },
    }),
    prisma.cashBoxMovement.aggregate({
      where: { kind: "WITHDRAWAL", counterparty: "PERSONAL_FINANCES" },
      _sum: { amount: true },
    }),
    prisma.cashBox.findMany({
      where: { active: true },
      select: { movements: { select: { amount: true } } },
    }),
    // Independent of the box: a loan in a deactivated or missing box still counts
    // as capital out (spec §5), unlike cashBoxesAvailable, which is lending power.
    prisma.loan.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { status: true, principalAmount: true, installments: { select: { principalPaid: true } } },
    }),
  ]);

  const totalIncome = toDecimal(income._sum.amount ?? 0);
  const totalExpense = toDecimal(expense._sum.amount ?? 0);
  // Ledger amounts are signed: deposits are positive, withdrawals negative.
  const depositsFromPersonal = toDecimal(deposits._sum.amount ?? 0);
  const withdrawalsToPersonal = toDecimal(withdrawals._sum.amount ?? 0).abs();

  const cashBoxesAvailable = sumMoney(boxes.map((box) => cashBoxBalance(box.movements)));
  const lentOut = outstandingPrincipal(
    loans.map((loan) => ({
      principalAmount: loan.principalAmount,
      principalPaid: sumMoney(loan.installments.map((i) => i.principalPaid)),
      status: loan.status,
    })),
  );

  const available = totalIncome.minus(totalExpense).minus(depositsFromPersonal).plus(withdrawalsToPersonal);

  return {
    totalIncome: toNumber(totalIncome),
    totalExpense: toNumber(totalExpense),
    depositsFromPersonal: toNumber(depositsFromPersonal),
    withdrawalsToPersonal: toNumber(withdrawalsToPersonal),
    available: toNumber(available),
    cashBoxesAvailable: toNumber(cashBoxesAvailable),
    lentOut: toNumber(lentOut),
    netWorth: toNumber(available.plus(cashBoxesAvailable).plus(lentOut)),
  };
}
