import type Decimal from "decimal.js";

import { maxMoney, type MoneyInput, roundMoney, sumMoney, toDecimal, ZERO } from "./money";

/** Credit still usable on the card; never negative even when the card is over its limit. */
export function cardAvailable(creditLimit: MoneyInput, balance: MoneyInput): Decimal {
  return maxMoney(toDecimal(creditLimit).minus(toDecimal(balance)), ZERO);
}

/** Percentage of the limit in use (40 means 40 %), one decimal; 0 when there is no limit. */
export function cardUtilization(creditLimit: MoneyInput, balance: MoneyInput): number {
  const limit = toDecimal(creditLimit);
  if (limit.lte(0)) return 0;
  return toDecimal(balance).div(limit).mul(100).toDecimalPlaces(1).toNumber();
}

/** What the app assumes the user will pay this cycle. */
export function suggestedPayment(paymentAmount: MoneyInput | null, minimumPayment: MoneyInput | null): Decimal {
  if (paymentAmount !== null && paymentAmount !== undefined) return roundMoney(paymentAmount);
  if (minimumPayment !== null && minimumPayment !== undefined) return roundMoney(minimumPayment);
  return ZERO;
}

export type InstallmentPlanLike = {
  installments: number;
  paidInstallments: number;
  installmentAmount: MoneyInput;
};

export function planRemaining(plan: InstallmentPlanLike) {
  const remainingInstallments = Math.max(plan.installments - plan.paidInstallments, 0);
  return {
    remainingInstallments,
    remainingAmount: roundMoney(toDecimal(plan.installmentAmount).mul(remainingInstallments)),
    finished: remainingInstallments === 0,
  };
}

/** Sum of the monthly installment of every plan that still has installments left. */
export function installmentsThisMonth(plans: readonly InstallmentPlanLike[]): Decimal {
  return roundMoney(
    sumMoney(plans.filter((plan) => !planRemaining(plan).finished).map((plan) => plan.installmentAmount)),
  );
}

/** Balance after a payment; a payment larger than the balance leaves it at zero. */
export function applyPayment(balance: MoneyInput, amount: MoneyInput): Decimal {
  return maxMoney(roundMoney(toDecimal(balance).minus(toDecimal(amount))), ZERO);
}
