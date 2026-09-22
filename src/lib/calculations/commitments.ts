import type Decimal from "decimal.js";

import { daysBetweenIso, endOfMonthIso, type IsoDate } from "@/lib/dates";

import { suggestedPayment } from "./credit-cards";
import { type MoneyInput, roundMoney, sumMoney, toDecimal, ZERO } from "./money";
import { monthlyEquivalent, type RecurringFrequencyValue } from "./recurring";

export type CommitmentStatus = "OVERDUE" | "DUE_TODAY" | "ALERT" | "UPCOMING";

/** Where a due date stands relative to today and the item's own reminder window. */
export function commitmentStatus(
  today: IsoDate,
  dueDate: IsoDate,
  reminderDays: number,
): { status: CommitmentStatus; daysUntilDue: number } {
  const daysUntilDue = daysBetweenIso(today, dueDate);
  if (daysUntilDue < 0) return { status: "OVERDUE", daysUntilDue };
  if (daysUntilDue === 0) return { status: "DUE_TODAY", daysUntilDue };
  if (daysUntilDue <= reminderDays) return { status: "ALERT", daysUntilDue };
  return { status: "UPCOMING", daysUntilDue };
}

export function isAlertActive(status: CommitmentStatus): boolean {
  return status !== "UPCOMING";
}

export type PlanRecurring = {
  amount: MoneyInput;
  nextDueDate: IsoDate;
  paymentMethod: string;
  frequency: RecurringFrequencyValue;
  customIntervalDays?: number | null;
  category: string;
  active: boolean;
};

export type PlanCard = {
  paymentAmount: MoneyInput | null;
  minimumPayment: MoneyInput | null;
  nextPaymentDate: IsoDate;
  active: boolean;
};

export type MonthPlanCategory = { category: string; monthly: Decimal; count: number };

export type MonthPlan = {
  /** Cash recurring payments still due this month (overdue included; card-paid ones excluded). */
  recurringPending: Decimal;
  /** Suggested card payments due this month. */
  cardPending: Decimal;
  reserveNeeded: Decimal;
  /** monthIncome − monthExpense − reserveNeeded. Paid items already sit inside monthExpense. */
  estimatedAvailable: Decimal;
  /** Monthly equivalent of every active recurring expense, regardless of due date. */
  monthlyCommitted: Decimal;
  byCategory: MonthPlanCategory[];
};

export function buildMonthPlan(input: {
  today: IsoDate;
  monthIncome: MoneyInput;
  monthExpense: MoneyInput;
  recurring: readonly PlanRecurring[];
  cards: readonly PlanCard[];
}): MonthPlan {
  const monthEnd = endOfMonthIso(input.today);
  const activeRecurring = input.recurring.filter((r) => r.active);

  const recurringPending = roundMoney(
    sumMoney(
      activeRecurring
        .filter((r) => r.paymentMethod !== "CREDIT_CARD" && r.nextDueDate <= monthEnd)
        .map((r) => r.amount),
    ),
  );

  const cardPending = roundMoney(
    sumMoney(
      input.cards
        .filter((c) => c.active && c.nextPaymentDate <= monthEnd)
        .map((c) => suggestedPayment(c.paymentAmount, c.minimumPayment)),
    ),
  );

  const byCategoryMap = new Map<string, MonthPlanCategory>();
  for (const r of activeRecurring) {
    const monthly = monthlyEquivalent(r.amount, r.frequency, r.customIntervalDays);
    const current = byCategoryMap.get(r.category) ?? { category: r.category, monthly: ZERO, count: 0 };
    byCategoryMap.set(r.category, { category: r.category, monthly: current.monthly.plus(monthly), count: current.count + 1 });
  }
  const byCategory = [...byCategoryMap.values()].sort((a, b) => b.monthly.comparedTo(a.monthly));
  const monthlyCommitted = roundMoney(sumMoney(byCategory.map((c) => c.monthly)));

  const reserveNeeded = recurringPending.plus(cardPending);
  return {
    recurringPending,
    cardPending,
    reserveNeeded,
    estimatedAvailable: roundMoney(toDecimal(input.monthIncome).minus(toDecimal(input.monthExpense)).minus(reserveNeeded)),
    monthlyCommitted,
    byCategory,
  };
}

/** Overdue items plus those due within `horizonDays`, ordered by date then name. */
export function filterUpcoming<T extends { dueDate: IsoDate; daysUntilDue: number; name: string }>(
  items: readonly T[],
  horizonDays: number,
): T[] {
  return items
    .filter((item) => item.daysUntilDue <= horizonDays)
    .sort((a, b) => (a.dueDate === b.dueDate ? a.name.localeCompare(b.name, "es") : a.dueDate.localeCompare(b.dueDate)));
}
