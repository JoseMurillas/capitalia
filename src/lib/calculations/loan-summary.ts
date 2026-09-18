import type Decimal from "decimal.js";

import type { IsoDate } from "@/lib/dates";

import { type MoneyInput, sumMoney, toDecimal, ZERO } from "./money";
import type { InstallmentStatus } from "./status";

export type SummaryInstallment = {
  id: string;
  installmentNumber: number;
  dueDate: IsoDate;
  principalAmount: MoneyInput;
  interestAmount: MoneyInput;
  totalAmount: MoneyInput;
  principalPaid: MoneyInput;
  interestPaid: MoneyInput;
  paidAmount: MoneyInput;
  status: InstallmentStatus;
};

export type NextInstallment = {
  id: string;
  installmentNumber: number;
  dueDate: IsoDate;
  /** Serialised with two decimals so it can cross to the client untouched. */
  pendingAmount: string;
  status: InstallmentStatus;
};

export type LoanSummary = {
  totalPrincipal: Decimal;
  totalInterest: Decimal;
  totalAmount: Decimal;
  totalPaid: Decimal;
  principalPaid: Decimal;
  interestPaid: Decimal;
  principalBalance: Decimal;
  interestBalance: Decimal;
  balance: Decimal;
  nextInstallment: NextInstallment | null;
  paidCount: number;
  overdueCount: number;
};

/** Aggregates a loan's installments into the figures every screen shows. */
export function summarizeInstallments(installments: readonly SummaryInstallment[]): LoanSummary {
  const ordered = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);

  const totalPrincipal = sumMoney(ordered.map((i) => i.principalAmount));
  const totalInterest = sumMoney(ordered.map((i) => i.interestAmount));
  const totalAmount = sumMoney(ordered.map((i) => i.totalAmount));
  const principalPaid = sumMoney(ordered.map((i) => i.principalPaid));
  const interestPaid = sumMoney(ordered.map((i) => i.interestPaid));
  const totalPaid = sumMoney(ordered.map((i) => i.paidAmount));

  const next = ordered.find((i) => i.status !== "PAID") ?? null;

  return {
    totalPrincipal,
    totalInterest,
    totalAmount,
    totalPaid,
    principalPaid,
    interestPaid,
    principalBalance: totalPrincipal.minus(principalPaid),
    interestBalance: totalInterest.minus(interestPaid),
    balance: totalAmount.minus(totalPaid),
    nextInstallment: next
      ? {
          id: next.id,
          installmentNumber: next.installmentNumber,
          dueDate: next.dueDate,
          pendingAmount: toDecimal(next.totalAmount).minus(toDecimal(next.paidAmount)).toFixed(2),
          status: next.status,
        }
      : null,
    paidCount: ordered.filter((i) => i.status === "PAID").length,
    overdueCount: ordered.filter((i) => i.status === "OVERDUE").length,
  };
}

export function emptyLoanSummary(): LoanSummary {
  return {
    totalPrincipal: ZERO,
    totalInterest: ZERO,
    totalAmount: ZERO,
    totalPaid: ZERO,
    principalPaid: ZERO,
    interestPaid: ZERO,
    principalBalance: ZERO,
    interestBalance: ZERO,
    balance: ZERO,
    nextInstallment: null,
    paidCount: 0,
    overdueCount: 0,
  };
}
