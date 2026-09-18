import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { sumMoney, toNumber } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, pageCountFor, paginate } from "@/lib/search-params";
import { requireSession } from "@/server/auth";
import { syncOverdueStatuses } from "@/server/services/loans";
import type { PaginatedResult } from "@/types";

import {
  type LoanSummaryDto,
  loanSummaryInclude,
  type PaymentDto,
  paymentInclude,
  toLoanSummaryDto,
  toPaymentDto,
} from "./loan-dto";

export type PersonStatusFilter = "active" | "inactive" | "all";

export type PersonListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  activeLoans: number;
  balance: number;
};

export type PersonListParams = {
  q?: string;
  status?: PersonStatusFilter;
  page?: number;
  pageSize?: number;
};

export async function listPeople(params: PersonListParams = {}): Promise<PaginatedResult<PersonListItem>> {
  await requireSession();
  await syncOverdueStatuses();

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const status = params.status ?? "all";

  const where: Prisma.PersonWhereInput = {
    ...(status === "active" ? { active: true } : status === "inactive" ? { active: false } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { document: { contains: params.q, mode: "insensitive" } },
            { phone: { contains: params.q, mode: "insensitive" } },
            { email: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, people] = await Promise.all([
    prisma.person.count({ where }),
    prisma.person.findMany({
      where,
      orderBy: [{ active: "desc" }, { name: "asc" }],
      ...paginate(page, pageSize),
      include: {
        loans: {
          where: { status: { in: ["ACTIVE", "OVERDUE"] } },
          select: { installments: { select: { totalAmount: true, paidAmount: true } } },
        },
      },
    }),
  ]);

  return {
    items: people.map((person) => {
      const installments = person.loans.flatMap((loan) => loan.installments);
      const balance = sumMoney(installments.map((i) => i.totalAmount)).minus(
        sumMoney(installments.map((i) => i.paidAmount)),
      );
      return {
        id: person.id,
        name: person.name,
        phone: person.phone,
        email: person.email,
        document: person.document,
        address: person.address,
        notes: person.notes,
        active: person.active,
        activeLoans: person.loans.length,
        balance: toNumber(balance),
      };
    }),
    total,
    page,
    pageSize,
    pageCount: pageCountFor(total, pageSize),
  };
}

export type PersonDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  totals: {
    totalLent: number;
    totalPaid: number;
    balance: number;
    interestGenerated: number;
    interestCollected: number;
    activeLoans: number;
  };
  loans: LoanSummaryDto[];
  payments: PaymentDto[];
};

export const getPersonDetail = cache(async (id: string): Promise<PersonDetail | null> => {
  await requireSession();
  await syncOverdueStatuses();

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      loans: { include: loanSummaryInclude, orderBy: { createdAt: "desc" } },
    },
  });
  if (!person) return null;

  const payments = await prisma.payment.findMany({
    where: { loan: { personId: id } },
    include: paymentInclude,
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
  });

  const loans = person.loans.map(toLoanSummaryDto);
  const counted = loans.filter((l) => l.status !== "CANCELLED");
  const open = loans.filter((l) => l.status === "ACTIVE" || l.status === "OVERDUE");

  return {
    id: person.id,
    name: person.name,
    phone: person.phone,
    email: person.email,
    document: person.document,
    address: person.address,
    notes: person.notes,
    active: person.active,
    createdAt: person.createdAt.toISOString(),
    totals: {
      totalLent: sum(counted.map((l) => l.principalAmount)),
      totalPaid: sum(counted.map((l) => l.totalPaid)),
      balance: sum(open.map((l) => l.balance)),
      interestGenerated: sum(counted.map((l) => l.totalInterest)),
      interestCollected: sum(counted.map((l) => l.interestPaid)),
      activeLoans: open.length,
    },
    loans,
    payments: payments.map(toPaymentDto),
  };
});

export type PersonOption = { id: string; name: string; document: string | null };

export async function listActivePeopleOptions(): Promise<PersonOption[]> {
  await requireSession();
  return prisma.person.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, document: true },
  });
}

function sum(values: number[]): number {
  return toNumber(sumMoney(values));
}
