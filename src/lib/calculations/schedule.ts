import type Decimal from "decimal.js";

import { addDaysIso, addMonthsIso, type IsoDate } from "@/lib/dates";

import type { InstallmentFrequency } from "./interest";
import { getInterestStrategy, type InterestType } from "./interest-strategies";
import { type MoneyInput, roundMoney, sumMoney, toDecimal } from "./money";

export type ScheduleParams = {
  principalAmount: MoneyInput;
  monthlyInterestRate: MoneyInput;
  interestType: InterestType;
  numberOfInstallments: number;
  installmentFrequency: InstallmentFrequency;
  customIntervalDays?: number | null;
  startDate: IsoDate;
};

export type ScheduledInstallment = {
  installmentNumber: number;
  dueDate: IsoDate;
  principalAmount: Decimal;
  interestAmount: Decimal;
  totalAmount: Decimal;
};

export type LoanTotals = {
  totalPrincipal: Decimal;
  totalInterest: Decimal;
  totalAmount: Decimal;
};

/** Due date of installment `k` (1-based), always measured from the start date. */
export function calculateDueDate(
  startDate: IsoDate,
  frequency: InstallmentFrequency,
  installmentNumber: number,
  customIntervalDays?: number | null,
): IsoDate {
  switch (frequency) {
    case "MONTHLY":
      return addMonthsIso(startDate, installmentNumber);
    case "BIWEEKLY":
      return addDaysIso(startDate, 15 * installmentNumber);
    case "WEEKLY":
      return addDaysIso(startDate, 7 * installmentNumber);
    case "CUSTOM":
      if (!customIntervalDays || customIntervalDays <= 0) {
        throw new Error("CUSTOM frequency requires a positive customIntervalDays");
      }
      return addDaysIso(startDate, customIntervalDays * installmentNumber);
  }
}

/**
 * Splits the principal evenly across installments; the rounding remainder is
 * added to the last installment so the parts always add up to the principal.
 */
function splitPrincipal(principal: Decimal, count: number): Decimal[] {
  const share = roundMoney(principal.div(count));
  const parts = Array.from({ length: count }, () => share);
  const allocated = share.times(count);
  parts[count - 1] = roundMoney(share.plus(principal.minus(allocated)));
  return parts;
}

export function generateSchedule(params: ScheduleParams): ScheduledInstallment[] {
  const count = params.numberOfInstallments;
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("numberOfInstallments must be a positive integer");
  }

  const principal = roundMoney(params.principalAmount);
  if (principal.lte(0)) {
    throw new Error("principalAmount must be greater than zero");
  }

  const rate = toDecimal(params.monthlyInterestRate);
  const strategy = getInterestStrategy(params.interestType);
  const principalParts = splitPrincipal(principal, count);

  let outstanding = principal;
  return principalParts.map((principalAmount, index) => {
    const installmentNumber = index + 1;
    const interestAmount = strategy.installmentInterest({
      principalAmount: principal,
      monthlyInterestRate: rate,
      installmentFrequency: params.installmentFrequency,
      customIntervalDays: params.customIntervalDays,
      numberOfInstallments: count,
      installmentNumber,
      outstandingPrincipal: outstanding,
    });
    outstanding = outstanding.minus(principalAmount);

    return {
      installmentNumber,
      dueDate: calculateDueDate(
        params.startDate,
        params.installmentFrequency,
        installmentNumber,
        params.customIntervalDays,
      ),
      principalAmount,
      interestAmount,
      totalAmount: roundMoney(principalAmount.plus(interestAmount)),
    };
  });
}

export function calculateLoanDueDate(params: ScheduleParams): IsoDate {
  return calculateDueDate(
    params.startDate,
    params.installmentFrequency,
    params.numberOfInstallments,
    params.customIntervalDays,
  );
}

export function calculateLoanTotals(
  installments: readonly Pick<ScheduledInstallment, "principalAmount" | "interestAmount" | "totalAmount">[],
): LoanTotals {
  return {
    totalPrincipal: sumMoney(installments.map((i) => i.principalAmount)),
    totalInterest: sumMoney(installments.map((i) => i.interestAmount)),
    totalAmount: sumMoney(installments.map((i) => i.totalAmount)),
  };
}
