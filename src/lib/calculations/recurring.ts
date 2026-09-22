import type Decimal from "decimal.js";

import { addDaysIso, addMonthsIso, type IsoDate } from "@/lib/dates";

import { type MoneyInput, roundMoney, toDecimal } from "./money";

/** Mirrors the Prisma enum so this module stays free of generated imports. */
export type RecurringFrequencyValue =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "CUSTOM";

const DAYS_PER_MONTH = 30;

/**
 * How much a recurring payment costs per month, so commitments with different
 * cadences can be added up. Weekly uses 52 weeks / 12 months; biweekly is twice a
 * month (same convention as loans); custom intervals assume 30-day months.
 */
export function monthlyEquivalent(
  amount: MoneyInput,
  frequency: RecurringFrequencyValue,
  customIntervalDays?: number | null,
): Decimal {
  const value = toDecimal(amount);
  switch (frequency) {
    case "WEEKLY":
      return roundMoney(value.mul(52).div(12));
    case "BIWEEKLY":
      return roundMoney(value.mul(2));
    case "MONTHLY":
      return roundMoney(value);
    case "QUARTERLY":
      return roundMoney(value.div(3));
    case "SEMIANNUAL":
      return roundMoney(value.div(6));
    case "ANNUAL":
      return roundMoney(value.div(12));
    case "CUSTOM":
      return roundMoney(customIntervalDays ? value.mul(DAYS_PER_MONTH).div(customIntervalDays) : value);
  }
}

/**
 * Next due date after a payment. Starts from the *scheduled* date (not today) so the
 * cadence is preserved when the user pays a few days late. Advances exactly one period.
 */
export function advanceDueDate(
  dueDate: IsoDate,
  frequency: RecurringFrequencyValue,
  customIntervalDays?: number | null,
): IsoDate {
  switch (frequency) {
    case "WEEKLY":
      return addDaysIso(dueDate, 7);
    case "BIWEEKLY":
      return addDaysIso(dueDate, 15);
    case "MONTHLY":
      return addMonthsIso(dueDate, 1);
    case "QUARTERLY":
      return addMonthsIso(dueDate, 3);
    case "SEMIANNUAL":
      return addMonthsIso(dueDate, 6);
    case "ANNUAL":
      return addMonthsIso(dueDate, 12);
    case "CUSTOM":
      return customIntervalDays ? addDaysIso(dueDate, customIntervalDays) : addMonthsIso(dueDate, 1);
  }
}
