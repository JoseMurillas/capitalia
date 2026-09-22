import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { RecurringFrequency, RecurringPaymentMethod, TransactionCategory } from "@/generated/prisma/enums";
import {
  buildMonthPlan,
  type CommitmentStatus,
  commitmentStatus,
  isAlertActive,
  monthlyEquivalent,
  toNumber,
} from "@/lib/calculations";
import { type IsoDate, todayIso, toIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { RecurringStatusFilter } from "@/lib/validations/recurring";
import { requireSession } from "@/server/auth";

export type RecurringExpenseDto = {
  id: string;
  name: string;
  category: TransactionCategory;
  amount: number;
  isVariable: boolean;
  frequency: RecurringFrequency;
  customIntervalDays: number | null;
  nextDueDate: IsoDate;
  paymentMethod: RecurringPaymentMethod;
  creditCardId: string | null;
  creditCardName: string | null;
  reminderDays: number;
  lastPaidDate: IsoDate | null;
  active: boolean;
  notes: string | null;
  /** What this expense costs per month, whatever its cadence. */
  monthlyEquivalent: number;
  daysUntilDue: number;
  status: CommitmentStatus;
};

export type RecurringListParams = {
  status?: RecurringStatusFilter;
  category?: TransactionCategory;
};

export type RecurringSummaryCategory = { category: TransactionCategory; monthly: number; count: number };

export type RecurringSummary = {
  activeCount: number;
  monthlyCommitted: number;
  byCategory: RecurringSummaryCategory[];
  /** Active expenses that are overdue, due today or inside their reminder window. */
  alertCount: number;
};

const recurringInclude = {
  creditCard: { select: { id: true, name: true, active: true } },
} satisfies Prisma.RecurringExpenseInclude;

type RecurringRow = Prisma.RecurringExpenseGetPayload<{ include: typeof recurringInclude }>;

function toDto(r: RecurringRow, today: IsoDate): RecurringExpenseDto {
  const nextDueDate = toIsoDate(r.nextDueDate);
  const { status, daysUntilDue } = commitmentStatus(today, nextDueDate, r.reminderDays);
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    amount: toNumber(r.amount),
    isVariable: r.isVariable,
    frequency: r.frequency,
    customIntervalDays: r.customIntervalDays,
    nextDueDate,
    paymentMethod: r.paymentMethod,
    creditCardId: r.creditCardId,
    creditCardName: r.creditCard?.name ?? null,
    reminderDays: r.reminderDays,
    lastPaidDate: r.lastPaidDate ? toIsoDate(r.lastPaidDate) : null,
    active: r.active,
    notes: r.notes,
    monthlyEquivalent: toNumber(monthlyEquivalent(r.amount, r.frequency, r.customIntervalDays)),
    daysUntilDue,
    status,
  };
}

export async function listRecurringExpenses(params: RecurringListParams = {}): Promise<RecurringExpenseDto[]> {
  await requireSession();
  const status = params.status ?? "active";
  const where: Prisma.RecurringExpenseWhereInput = {
    ...(status === "all" ? {} : { active: status === "active" }),
    ...(params.category ? { category: params.category } : {}),
  };
  const rows = await prisma.recurringExpense.findMany({
    where,
    include: recurringInclude,
    orderBy: [{ active: "desc" }, { nextDueDate: "asc" }, { name: "asc" }],
  });
  const today = todayIso();
  return rows.map((row) => toDto(row, today));
}

/** Monthly equivalent of every active recurring expense, grouped by category. */
export async function getRecurringSummary(): Promise<RecurringSummary> {
  const active = await listRecurringExpenses({ status: "active" });
  const plan = buildMonthPlan({ today: todayIso(), monthIncome: 0, monthExpense: 0, recurring: active, cards: [] });
  return {
    activeCount: active.length,
    monthlyCommitted: toNumber(plan.monthlyCommitted),
    byCategory: plan.byCategory.map((c) => ({
      category: c.category as TransactionCategory,
      monthly: toNumber(c.monthly),
      count: c.count,
    })),
    alertCount: active.filter((e) => isAlertActive(e.status)).length,
  };
}
