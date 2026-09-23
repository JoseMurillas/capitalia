import "server-only";

import type { InstallmentStatus } from "@/generated/prisma/enums";
import { sumMoney, toDecimal, toNumber } from "@/lib/calculations";
import {
  addDaysIso,
  endOfMonthIso,
  fromIsoDate,
  type IsoDate,
  monthKey,
  startOfMonthIso,
  subMonthsIso,
  todayIso,
  toIsoDate,
} from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth";
import { syncOverdueStatuses } from "@/server/services/loans";

import { getCashPosition } from "./cash";
import { type LoanSummaryDto, loanSummaryInclude, toLoanSummaryDto } from "./loan-dto";

export type DashboardMetrics = {
  capitalLent: number;
  receivable: number;
  interestGenerated: number;
  interestCollected: number;
  monthProfit: number;
  activeLoans: number;
  overdueLoans: number;
  available: number;
  cashBoxesAvailable: number;
  lentOut: number;
  netWorth: number;
};

export type MonthlyCashFlowPoint = { month: string; income: number; expense: number };
export type MonthlyInterestPoint = { month: string; interest: number };
export type LoanStatusPoint = { status: "ACTIVE" | "PAID" | "OVERDUE"; count: number };

export type UpcomingInstallment = {
  id: string;
  loanId: string;
  personName: string;
  installmentNumber: number;
  dueDate: IsoDate;
  pendingAmount: number;
  status: InstallmentStatus;
  daysUntilDue: number;
};

export type DashboardData = {
  today: IsoDate;
  metrics: DashboardMetrics;
  monthlyCashFlow: MonthlyCashFlowPoint[];
  monthlyInterest: MonthlyInterestPoint[];
  loanStatus: LoanStatusPoint[];
  upcomingInstallments: UpcomingInstallment[];
  overdueLoans: LoanSummaryDto[];
};

const MONTHS_IN_CHARTS = 6;
const UPCOMING_DAYS = 14;
const LIST_LIMIT = 8;

function lastMonths(today: IsoDate, count: number): string[] {
  return Array.from({ length: count }, (_, i) => monthKey(subMonthsIso(today, count - 1 - i)));
}

export async function getDashboardData(): Promise<DashboardData> {
  await requireSession();
  await syncOverdueStatuses();

  const today = todayIso();
  const months = lastMonths(today, MONTHS_IN_CHARTS);
  const chartStart = fromIsoDate(`${months[0]}-01`);
  const monthStart = fromIsoDate(startOfMonthIso(today));
  const monthEnd = fromIsoDate(endOfMonthIso(today));
  const upcomingEnd = fromIsoDate(addDaysIso(today, UPCOMING_DAYS));

  const [
    openLoans,
    interestGenerated,
    interestCollected,
    monthInterest,
    statusCounts,
    transactions,
    payments,
    upcoming,
    overdueLoans,
    cash,
  ] = await Promise.all([
    prisma.loan.findMany({
      where: { status: { in: ["ACTIVE", "OVERDUE"] } },
      select: {
        principalAmount: true,
        installments: { select: { totalAmount: true, paidAmount: true } },
      },
    }),
    prisma.installment.aggregate({
      where: { loan: { status: { not: "CANCELLED" } } },
      _sum: { interestAmount: true },
    }),
    prisma.payment.aggregate({ _sum: { interestPaid: true } }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: monthStart, lte: monthEnd } },
      _sum: { interestPaid: true },
    }),
    prisma.loan.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.transaction.findMany({
      where: { transactionDate: { gte: chartStart } },
      select: { type: true, amount: true, transactionDate: true },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: chartStart } },
      select: { interestPaid: true, paymentDate: true },
    }),
    prisma.installment.findMany({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: { gte: fromIsoDate(today), lte: upcomingEnd },
        loan: { status: { in: ["ACTIVE", "OVERDUE"] } },
      },
      orderBy: [{ dueDate: "asc" }, { installmentNumber: "asc" }],
      take: LIST_LIMIT,
      include: { loan: { select: { id: true, person: { select: { name: true } } } } },
    }),
    prisma.loan.findMany({
      where: { status: "OVERDUE" },
      include: loanSummaryInclude,
      orderBy: { dueDate: "asc" },
      take: LIST_LIMIT,
    }),
    getCashPosition(),
  ]);

  const capitalLent = sumMoney(openLoans.map((l) => l.principalAmount));
  const openInstallments = openLoans.flatMap((l) => l.installments);
  const receivable = sumMoney(openInstallments.map((i) => i.totalAmount)).minus(
    sumMoney(openInstallments.map((i) => i.paidAmount)),
  );

  const cashFlowByMonth = new Map(months.map((m) => [m, { income: toDecimal(0), expense: toDecimal(0) }]));
  for (const t of transactions) {
    const bucket = cashFlowByMonth.get(monthKey(toIsoDate(t.transactionDate)));
    if (!bucket) continue;
    if (t.type === "INCOME") bucket.income = bucket.income.plus(toDecimal(t.amount));
    else bucket.expense = bucket.expense.plus(toDecimal(t.amount));
  }

  const interestByMonth = new Map(months.map((m) => [m, toDecimal(0)]));
  for (const p of payments) {
    const key = monthKey(toIsoDate(p.paymentDate));
    const current = interestByMonth.get(key);
    if (current !== undefined) interestByMonth.set(key, current.plus(toDecimal(p.interestPaid)));
  }

  const countFor = (status: "ACTIVE" | "PAID" | "OVERDUE") =>
    statusCounts.find((row) => row.status === status)?._count._all ?? 0;

  return {
    today,
    metrics: {
      capitalLent: toNumber(capitalLent),
      receivable: toNumber(receivable),
      interestGenerated: toNumber(toDecimal(interestGenerated._sum.interestAmount ?? 0)),
      interestCollected: toNumber(toDecimal(interestCollected._sum.interestPaid ?? 0)),
      monthProfit: toNumber(toDecimal(monthInterest._sum.interestPaid ?? 0)),
      activeLoans: countFor("ACTIVE"),
      overdueLoans: countFor("OVERDUE"),
      available: cash.available,
      cashBoxesAvailable: cash.cashBoxesAvailable,
      lentOut: cash.lentOut,
      netWorth: cash.netWorth,
    },
    monthlyCashFlow: months.map((month) => {
      const bucket = cashFlowByMonth.get(month);
      return {
        month,
        income: toNumber(bucket?.income ?? 0),
        expense: toNumber(bucket?.expense ?? 0),
      };
    }),
    monthlyInterest: months.map((month) => ({
      month,
      interest: toNumber(interestByMonth.get(month) ?? 0),
    })),
    loanStatus: [
      { status: "ACTIVE", count: countFor("ACTIVE") },
      { status: "PAID", count: countFor("PAID") },
      { status: "OVERDUE", count: countFor("OVERDUE") },
    ],
    upcomingInstallments: upcoming.map((i) => {
      const dueDate = toIsoDate(i.dueDate);
      return {
        id: i.id,
        loanId: i.loan.id,
        personName: i.loan.person.name,
        installmentNumber: i.installmentNumber,
        dueDate,
        pendingAmount: toNumber(toDecimal(i.totalAmount).minus(toDecimal(i.paidAmount))),
        status: i.status,
        daysUntilDue: Math.round(
          (fromIsoDate(dueDate).getTime() - fromIsoDate(today).getTime()) / 86_400_000,
        ),
      };
    }),
    overdueLoans: overdueLoans.map(toLoanSummaryDto),
  };
}
