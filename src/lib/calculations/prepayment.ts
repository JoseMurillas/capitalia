import type Decimal from "decimal.js";

import { calculatePeriodInterest, type InstallmentFrequency } from "./interest";
import { maxMoney, type MoneyInput, roundMoney, sumMoney, toDecimal, ZERO } from "./money";
import type { PaymentAllocation } from "./payments";
import type { InstallmentStatus } from "./status";

export type PrepaymentInstallment = {
  id: string;
  installmentNumber: number;
  principalAmount: MoneyInput;
  principalPaid: MoneyInput;
  interestAmount: MoneyInput;
  interestPaid: MoneyInput;
  status: InstallmentStatus;
};

export type PrepaymentLoanTerms = {
  monthlyInterestRate: MoneyInput;
  installmentFrequency: InstallmentFrequency;
  customIntervalDays?: number | null;
};

export type RecalculatedInstallment = {
  id: string;
  installmentNumber: number;
  principalAmount: Decimal;
  principalPaid: Decimal;
  interestAmount: Decimal;
  interestPaid: Decimal;
  totalAmount: Decimal;
  paidAmount: Decimal;
};

export type PrincipalPrepayment = {
  allocations: PaymentAllocation[];
  principalPaid: Decimal;
  interestPaid: Decimal;
  newOutstandingPrincipal: Decimal;
  /** Pending installments with their new principal split and interest. */
  installments: RecalculatedInstallment[];
};

/** Equal parts with the rounding remainder on the last one, so parts add up exactly. */
function splitEvenly(total: Decimal, count: number): Decimal[] {
  const share = roundMoney(total.div(count));
  const parts = Array.from({ length: count }, () => share);
  parts[count - 1] = roundMoney(share.plus(total.minus(share.times(count))));
  return parts;
}

/**
 * "Abono a capital": the amount reduces the outstanding principal and the
 * pending installments are recalculated as if a new loan for the remaining
 * balance had been issued — principal spread evenly, interest charged on the
 * new balance. Interest already collected on an installment is never reduced.
 *
 * Invariants kept: paid + pending principal still equals the original
 * principal, and the abono is recorded as principal paid on each installment.
 */
export function calculatePrincipalPrepayment(
  installments: readonly PrepaymentInstallment[],
  amount: MoneyInput,
  terms: PrepaymentLoanTerms,
): PrincipalPrepayment {
  const abono = roundMoney(amount);
  if (abono.lte(0)) {
    throw new Error("Prepayment amount must be greater than zero");
  }

  const pending = [...installments]
    .filter((i) => i.status !== "PAID")
    .sort((a, b) => a.installmentNumber - b.installmentNumber);
  if (pending.length === 0) {
    throw new Error("The loan has no pending installments");
  }

  const outstanding = sumMoney(
    pending.map((i) => maxMoney(toDecimal(i.principalAmount).minus(toDecimal(i.principalPaid)), ZERO)),
  );
  if (abono.gt(outstanding)) {
    throw new Error("Prepayment exceeds the outstanding principal");
  }

  const newOutstanding = outstanding.minus(abono);
  const abonoShares = splitEvenly(abono, pending.length);
  const pendingShares = splitEvenly(newOutstanding, pending.length);
  const newInterest = newOutstanding.gt(0)
    ? calculatePeriodInterest(
        newOutstanding,
        terms.monthlyInterestRate,
        terms.installmentFrequency,
        terms.customIntervalDays,
      )
    : ZERO;

  const allocations: PaymentAllocation[] = [];
  const recalculated: RecalculatedInstallment[] = pending.map((installment, index) => {
    const principalPaid = toDecimal(installment.principalPaid).plus(abonoShares[index]);
    const principalAmount = principalPaid.plus(pendingShares[index]);
    const interestPaid = toDecimal(installment.interestPaid);
    const interestAmount = maxMoney(newInterest, interestPaid);

    allocations.push({
      installmentId: installment.id,
      installmentNumber: installment.installmentNumber,
      interestPaid: ZERO,
      principalPaid: abonoShares[index],
    });

    return {
      id: installment.id,
      installmentNumber: installment.installmentNumber,
      principalAmount,
      principalPaid,
      interestAmount,
      interestPaid,
      totalAmount: principalAmount.plus(interestAmount),
      paidAmount: principalPaid.plus(interestPaid),
    };
  });

  return {
    allocations,
    principalPaid: abono,
    interestPaid: ZERO,
    newOutstandingPrincipal: newOutstanding,
    installments: recalculated,
  };
}
