import { daysBetweenIso, type IsoDate } from "@/lib/dates";

import { type MoneyInput, toDecimal } from "./money";

/** Mirrors the Prisma enum so this module stays free of generated imports. */
export type ReminderKindValue = "BEFORE_DUE" | "OVERDUE";

export type ReminderInstallmentLike = {
  dueDate: IsoDate;
  totalAmount: MoneyInput;
  paidAmount: MoneyInput;
  /** Loan status: a CANCELLED loan never gets reminders. */
  loanStatus: string;
};

export type ReminderDue = { kind: ReminderKindValue; daysOverdue: number | null };

/** Whole days past the due date; negative while the date is still ahead. */
export function daysOverdue(today: IsoDate, dueDate: IsoDate): number {
  return daysBetweenIso(dueDate, today);
}

const WEEK = 7;

/**
 * The single reminder an installment deserves today, or null. One warning the
 * day before it falls due; then, while it stays unpaid, one the day after and
 * one a week apart from there (days +1, +8, +15…).
 */
export function reminderDueOn(installment: ReminderInstallmentLike, today: IsoDate): ReminderDue | null {
  if (installment.loanStatus === "CANCELLED") return null;
  if (toDecimal(installment.paidAmount).gte(toDecimal(installment.totalAmount))) return null;

  const late = daysOverdue(today, installment.dueDate);
  if (late === -1) return { kind: "BEFORE_DUE", daysOverdue: null };
  if (late >= 1 && (late - 1) % WEEK === 0) return { kind: "OVERDUE", daysOverdue: late };
  return null;
}

/**
 * Whether a reminder written another day can still be sent today. Its text is
 * written for the day it goes out — "vence mañana", "vencida hace 8 días" — so
 * resending one only makes sense while that sentence is still true. Returns the
 * days late to put in the text, or null when it no longer applies.
 */
export function resendableAs(kind: ReminderKindValue, today: IsoDate, dueDate: IsoDate): number | null | false {
  const late = daysOverdue(today, dueDate);
  if (kind === "BEFORE_DUE") return late === -1 ? null : false;
  return late >= 1 ? late : false;
}
