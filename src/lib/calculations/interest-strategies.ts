import type Decimal from "decimal.js";

import { calculatePeriodInterest, type InstallmentFrequency } from "./interest";

export type InterestType = "SIMPLE";

/** Everything a strategy may need to price the interest of one installment. */
export type InterestContext = {
  principalAmount: Decimal;
  monthlyInterestRate: Decimal;
  installmentFrequency: InstallmentFrequency;
  customIntervalDays?: number | null;
  numberOfInstallments: number;
  installmentNumber: number;
  /** Principal still owed before this installment is paid. */
  outstandingPrincipal: Decimal;
};

export type InterestStrategy = {
  /** Interest charged on a single installment. */
  installmentInterest: (context: InterestContext) => Decimal;
};

/**
 * SIMPLE: flat interest on the initial principal for every installment
 * ("el 12 % del millón cada mes"). The schedule is fixed when the loan is created.
 */
const simpleInterest: InterestStrategy = {
  installmentInterest: (ctx) =>
    calculatePeriodInterest(
      ctx.principalAmount,
      ctx.monthlyInterestRate,
      ctx.installmentFrequency,
      ctx.customIntervalDays,
    ),
};

const strategies: Record<InterestType, InterestStrategy> = {
  SIMPLE: simpleInterest,
};

export function getInterestStrategy(type: InterestType): InterestStrategy {
  return strategies[type];
}
