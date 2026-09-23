import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import type { LoanStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, pageCountFor, paginate } from "@/lib/search-params";
import { requireSession } from "@/server/auth";
import { syncOverdueStatuses } from "@/server/services/loans";
import type { PaginatedResult } from "@/types";

import {
  type InstallmentDto,
  type LoanSummaryDto,
  loanSummaryInclude,
  type PaymentDto,
  paymentInclude,
  toInstallmentDto,
  toLoanSummaryDto,
  toPaymentDto,
} from "./loan-dto";

export type LoanStatusFilter = LoanStatus | "ALL";

export type LoanListParams = {
  status?: LoanStatusFilter;
  q?: string;
  cashBoxId?: string;
  page?: number;
  pageSize?: number;
};

export type LoanListCounts = Record<LoanStatusFilter, number>;

export async function listLoans(
  params: LoanListParams = {},
): Promise<PaginatedResult<LoanSummaryDto> & { counts: LoanListCounts }> {
  await requireSession();
  await syncOverdueStatuses();

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const status = params.status ?? "ALL";

  const search: Prisma.LoanWhereInput = params.q
    ? {
        person: {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { document: { contains: params.q, mode: "insensitive" } },
          ],
        },
      }
    : {};
  const where: Prisma.LoanWhereInput = {
    ...search,
    ...(status === "ALL" ? {} : { status }),
    ...(params.cashBoxId ? { cashBoxId: params.cashBoxId } : {}),
  };

  const [total, loans, grouped] = await Promise.all([
    prisma.loan.count({ where }),
    prisma.loan.findMany({
      where,
      include: loanSummaryInclude,
      orderBy: [{ createdAt: "desc" }],
      ...paginate(page, pageSize),
    }),
    prisma.loan.groupBy({ by: ["status"], where: search, _count: { _all: true } }),
  ]);

  const counts: LoanListCounts = { ALL: 0, ACTIVE: 0, PAID: 0, OVERDUE: 0, CANCELLED: 0 };
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    counts.ALL += row._count._all;
  }

  return {
    items: loans.map(toLoanSummaryDto),
    total,
    page,
    pageSize,
    pageCount: pageCountFor(total, pageSize),
    counts,
  };
}

export type LoanDetail = LoanSummaryDto & {
  installments: InstallmentDto[];
  payments: PaymentDto[];
  paymentCount: number;
};

export const getLoanDetail = cache(async (id: string): Promise<LoanDetail | null> => {
  await requireSession();
  await syncOverdueStatuses();

  const loan = await prisma.loan.findUnique({
    where: { id },
    include: {
      ...loanSummaryInclude,
      payments: { include: paymentInclude, orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!loan) return null;

  return {
    ...toLoanSummaryDto(loan),
    installments: loan.installments.map(toInstallmentDto),
    payments: loan.payments.map(toPaymentDto),
    paymentCount: loan.payments.length,
  };
});

/** Open loans a payment can be registered against, for the payment dialog. */
export type LoanOption = {
  id: string;
  personName: string;
  principalAmount: number;
  balance: number;
  status: LoanStatus;
  installments: InstallmentDto[];
};

export async function listOpenLoanOptions(): Promise<LoanOption[]> {
  await requireSession();
  await syncOverdueStatuses();

  const loans = await prisma.loan.findMany({
    where: { status: { in: ["ACTIVE", "OVERDUE"] } },
    include: loanSummaryInclude,
    orderBy: [{ person: { name: "asc" } }, { createdAt: "desc" }],
  });

  return loans.map((loan) => {
    const summary = toLoanSummaryDto(loan);
    return {
      id: loan.id,
      personName: summary.personName,
      principalAmount: summary.principalAmount,
      balance: summary.balance,
      status: summary.status,
      installments: loan.installments.map(toInstallmentDto),
    };
  });
}
