import "server-only";

import { sumMoney, toDecimal, toNumber } from "@/lib/calculations";
import { fromIsoDate, type IsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth";
import { syncOverdueStatuses } from "@/server/services/loans";

import { type LoanSummaryDto, loanSummaryInclude, toLoanSummaryDto } from "./loan-dto";

export type ReportRange = { from: IsoDate; to: IsoDate };

export type LoanGroupTotals = {
  count: number;
  principal: number;
  interest: number;
  paid: number;
  balance: number;
};

export type ReportData = {
  range: ReportRange;
  period: {
    interestGenerated: number;
    interestCollected: number;
    principalCollected: number;
    paymentsReceived: number;
    newLoans: number;
    newLoansPrincipal: number;
    income: number;
    expense: number;
    profit: number;
  };
  portfolio: {
    principalOutstanding: number;
    interestOutstanding: number;
    balance: number;
  };
  activeLoans: LoanSummaryDto[];
  paidLoans: LoanSummaryDto[];
  overdueLoans: LoanSummaryDto[];
  totals: {
    active: LoanGroupTotals;
    paid: LoanGroupTotals;
    overdue: LoanGroupTotals;
  };
};

function groupTotals(loans: LoanSummaryDto[]): LoanGroupTotals {
  return {
    count: loans.length,
    principal: toNumber(sumMoney(loans.map((l) => l.principalAmount))),
    interest: toNumber(sumMoney(loans.map((l) => l.totalInterest))),
    paid: toNumber(sumMoney(loans.map((l) => l.totalPaid))),
    balance: toNumber(sumMoney(loans.map((l) => l.balance))),
  };
}

export async function getReport(range: ReportRange): Promise<ReportData> {
  await requireSession();
  await syncOverdueStatuses();

  const from = fromIsoDate(range.from);
  const to = fromIsoDate(range.to);
  const inRange = { gte: from, lte: to };

  const [
    interestGenerated,
    paymentsInRange,
    newLoans,
    transactions,
    openLoans,
    paidLoans,
  ] = await Promise.all([
    prisma.installment.aggregate({
      where: { dueDate: inRange, loan: { status: { not: "CANCELLED" } } },
      _sum: { interestAmount: true },
    }),
    prisma.payment.aggregate({
      where: { paymentDate: inRange },
      _sum: { amount: true, interestPaid: true, principalPaid: true },
      _count: { _all: true },
    }),
    prisma.loan.aggregate({
      where: { startDate: inRange, status: { not: "CANCELLED" } },
      _sum: { principalAmount: true },
      _count: { _all: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { transactionDate: inRange },
      _sum: { amount: true },
    }),
    prisma.loan.findMany({
      where: { status: { in: ["ACTIVE", "OVERDUE"] } },
      include: loanSummaryInclude,
      orderBy: [{ status: "desc" }, { dueDate: "asc" }],
    }),
    // Loans settled within the period: their last payment falls inside the range.
    prisma.loan.findMany({
      where: {
        status: "PAID",
        payments: { some: { paymentDate: inRange } },
        NOT: { payments: { some: { paymentDate: { gt: to } } } },
      },
      include: loanSummaryInclude,
      orderBy: { dueDate: "desc" },
    }),
  ]);

  const openSummaries = openLoans.map(toLoanSummaryDto);
  const activeLoans = openSummaries.filter((l) => l.status === "ACTIVE");
  const overdueLoans = openSummaries.filter((l) => l.status === "OVERDUE");
  const paidSummaries = paidLoans.map(toLoanSummaryDto);

  const income = toDecimal(transactions.find((t) => t.type === "INCOME")?._sum.amount ?? 0);
  const expense = toDecimal(transactions.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0);
  const interestCollected = toDecimal(paymentsInRange._sum.interestPaid ?? 0);

  return {
    range,
    period: {
      interestGenerated: toNumber(toDecimal(interestGenerated._sum.interestAmount ?? 0)),
      interestCollected: toNumber(interestCollected),
      principalCollected: toNumber(toDecimal(paymentsInRange._sum.principalPaid ?? 0)),
      paymentsReceived: paymentsInRange._count._all,
      newLoans: newLoans._count._all,
      newLoansPrincipal: toNumber(toDecimal(newLoans._sum.principalAmount ?? 0)),
      income: toNumber(income),
      expense: toNumber(expense),
      profit: toNumber(income.plus(interestCollected).minus(expense)),
    },
    portfolio: {
      principalOutstanding: toNumber(sumMoney(openSummaries.map((l) => l.principalBalance))),
      interestOutstanding: toNumber(sumMoney(openSummaries.map((l) => l.interestBalance))),
      balance: toNumber(sumMoney(openSummaries.map((l) => l.balance))),
    },
    activeLoans,
    paidLoans: paidSummaries,
    overdueLoans,
    totals: {
      active: groupTotals(activeLoans),
      paid: groupTotals(paidSummaries),
      overdue: groupTotals(overdueLoans),
    },
  };
}
