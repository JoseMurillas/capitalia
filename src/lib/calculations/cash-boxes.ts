import type Decimal from "decimal.js";

import { maxMoney, type MoneyInput, roundMoney, sumMoney, toDecimal, ZERO } from "./money";

/** Mirrors the Prisma enum so this module stays free of generated imports. */
export type CashBoxMovementKindValue =
  | "OPENING"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "LOAN_DISBURSEMENT"
  | "LOAN_PAYMENT"
  | "LOAN_REVERSAL"
  | "LOAN_REASSIGNMENT"
  | "ADJUSTMENT";

const OUTFLOWS: readonly CashBoxMovementKindValue[] = ["WITHDRAWAL", "TRANSFER_OUT", "LOAN_DISBURSEMENT"];
const INFLOWS: readonly CashBoxMovementKindValue[] = [
  "OPENING",
  "DEPOSIT",
  "TRANSFER_IN",
  "LOAN_PAYMENT",
  "LOAN_REVERSAL",
];

/**
 * Normalises the sign before a movement is written, so the ledger can be summed
 * blindly. Kinds that go both ways (adjustments, reassignments) keep the sign
 * the caller chose.
 */
export function signedAmount(kind: CashBoxMovementKindValue, amount: MoneyInput): Decimal {
  const value = roundMoney(amount);
  if (OUTFLOWS.includes(kind)) return value.abs().negated();
  if (INFLOWS.includes(kind)) return value.abs();
  return value;
}

/** A cash box's balance is its ledger, nothing else. */
export function cashBoxBalance(movements: readonly { amount: MoneyInput }[]): Decimal {
  return roundMoney(sumMoney(movements.map((m) => m.amount)));
}

export type LoanPrincipalLike = {
  principalAmount: MoneyInput;
  /** Principal already repaid across the loan's installments. */
  principalPaid: MoneyInput;
  status: string;
};

/** Capital of this box that is currently out in loans. */
export function outstandingPrincipal(loans: readonly LoanPrincipalLike[]): Decimal {
  return roundMoney(
    sumMoney(
      loans
        .filter((loan) => loan.status !== "CANCELLED")
        .map((loan) => maxMoney(toDecimal(loan.principalAmount).minus(toDecimal(loan.principalPaid)), ZERO)),
    ),
  );
}

/**
 * What a box really put into a loan: the capital it handed out minus everything
 * that has come back. Moving the loan elsewhere returns this amount to the old
 * box and takes it from the new one.
 */
export function reassignmentNet(principalAmount: MoneyInput, paymentsReceived: MoneyInput): Decimal {
  return roundMoney(toDecimal(principalAmount).minus(toDecimal(paymentsReceived)));
}

/** Annotates movements (oldest first) with the balance left after each one. */
export function runningBalance<T extends { amount: MoneyInput }>(
  movements: readonly T[],
): (T & { balance: Decimal })[] {
  let balance = ZERO;
  return movements.map((movement) => {
    balance = roundMoney(balance.plus(toDecimal(movement.amount)));
    return { ...movement, balance };
  });
}
