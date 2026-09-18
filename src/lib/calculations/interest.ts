import Decimal from "decimal.js";

import { type MoneyInput, roundMoney, toDecimal } from "./money";

export type InstallmentFrequency = "MONTHLY" | "BIWEEKLY" | "WEEKLY" | "CUSTOM";

const DAYS_PER_MONTH = 30;

/** Interest for one full month: principal × monthlyRate / 100. */
export function calculateMonthlyInterest(
  principal: MoneyInput,
  monthlyRatePercent: MoneyInput,
): Decimal {
  return roundMoney(toDecimal(principal).times(toDecimal(monthlyRatePercent)).div(100));
}

/** Fraction of a month covered by one installment period. */
export function monthsPerPeriod(
  frequency: InstallmentFrequency,
  customIntervalDays?: number | null,
): Decimal {
  switch (frequency) {
    case "MONTHLY":
      return new Decimal(1);
    case "BIWEEKLY":
      return new Decimal(0.5);
    case "WEEKLY":
      return new Decimal(0.25);
    case "CUSTOM":
      if (!customIntervalDays || customIntervalDays <= 0) {
        throw new Error("CUSTOM frequency requires a positive customIntervalDays");
      }
      return new Decimal(customIntervalDays).div(DAYS_PER_MONTH);
  }
}

/** Interest for one installment period, prorated from the monthly rate. */
export function calculatePeriodInterest(
  principal: MoneyInput,
  monthlyRatePercent: MoneyInput,
  frequency: InstallmentFrequency,
  customIntervalDays?: number | null,
): Decimal {
  const monthly = toDecimal(principal).times(toDecimal(monthlyRatePercent)).div(100);
  return roundMoney(monthly.times(monthsPerPeriod(frequency, customIntervalDays)));
}
