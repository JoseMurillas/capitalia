import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { TransactionCategory, TransactionType } from "@/generated/prisma/enums";
import { toDecimal, toNumber } from "@/lib/calculations";
import { endOfMonthIso, fromIsoDate, type IsoDate, startOfMonthIso, todayIso, toIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, pageCountFor, paginate } from "@/lib/search-params";
import { requireSession } from "@/server/auth";
import type { PaginatedResult } from "@/types";

import { getCashPosition } from "./cash";

export type TransactionDto = {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string;
  transactionDate: IsoDate;
  notes: string | null;
  createdAt: string;
  /** Created by "marcar pagado" on this recurring expense. */
  recurringExpenseId: string | null;
  /** Created by a credit-card payment; deleting it does not restore the card balance. */
  isCardPayment: boolean;
};

export type TransactionListParams = {
  from?: IsoDate;
  to?: IsoDate;
  type?: TransactionType;
  category?: TransactionCategory;
  page?: number;
  pageSize?: number;
};

export type TransactionListTotals = {
  income: number;
  expense: number;
  balance: number;
};

const transactionInclude = { cardMovement: { select: { id: true } } } satisfies Prisma.TransactionInclude;

function toDto(t: Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>): TransactionDto {
  return {
    id: t.id,
    type: t.type,
    category: t.category,
    amount: toNumber(t.amount),
    description: t.description,
    transactionDate: toIsoDate(t.transactionDate),
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    recurringExpenseId: t.recurringExpenseId,
    isCardPayment: t.cardMovement !== null,
  };
}

function dateFilter(from?: IsoDate, to?: IsoDate): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: fromIsoDate(from) } : {}),
    ...(to ? { lte: fromIsoDate(to) } : {}),
  };
}

export async function listTransactions(
  params: TransactionListParams = {},
): Promise<PaginatedResult<TransactionDto> & { totals: TransactionListTotals }> {
  await requireSession();

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const transactionDate = dateFilter(params.from, params.to);

  const where: Prisma.TransactionWhereInput = {
    ...(transactionDate ? { transactionDate } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.category ? { category: params.category } : {}),
  };

  const [total, rows, grouped] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      ...paginate(page, pageSize),
    }),
    prisma.transaction.groupBy({ by: ["type"], where, _sum: { amount: true } }),
  ]);

  const income = toDecimal(grouped.find((g) => g.type === "INCOME")?._sum.amount ?? 0);
  const expense = toDecimal(grouped.find((g) => g.type === "EXPENSE")?._sum.amount ?? 0);

  return {
    items: rows.map(toDto),
    total,
    page,
    pageSize,
    pageCount: pageCountFor(total, pageSize),
    totals: {
      income: toNumber(income),
      expense: toNumber(expense),
      balance: toNumber(income.minus(expense)),
    },
  };
}

export type FinanceSummary = {
  monthIncome: number;
  monthExpense: number;
  monthBalance: number;
  available: number;
  monthLabel: IsoDate;
};

export async function getFinanceSummary(): Promise<FinanceSummary> {
  await requireSession();

  const today = todayIso();
  const monthRange = { transactionDate: dateFilter(startOfMonthIso(today), endOfMonthIso(today)) };

  const [grouped, cash] = await Promise.all([
    prisma.transaction.groupBy({ by: ["type"], where: monthRange, _sum: { amount: true } }),
    getCashPosition(),
  ]);

  const monthIncome = toDecimal(grouped.find((g) => g.type === "INCOME")?._sum.amount ?? 0);
  const monthExpense = toDecimal(grouped.find((g) => g.type === "EXPENSE")?._sum.amount ?? 0);

  return {
    monthIncome: toNumber(monthIncome),
    monthExpense: toNumber(monthExpense),
    monthBalance: toNumber(monthIncome.minus(monthExpense)),
    available: cash.available,
    monthLabel: today,
  };
}
