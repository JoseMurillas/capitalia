import type Decimal from "decimal.js";

import { maxMoney, minMoney, type MoneyInput, roundMoney, toDecimal, ZERO } from "./money";

/** The part of an installment the distribution needs: what is owed and what was paid. */
export type InstallmentBalance = {
  id: string;
  installmentNumber: number;
  principalAmount: MoneyInput;
  principalPaid: MoneyInput;
  interestAmount: MoneyInput;
  interestPaid: MoneyInput;
};

export type PaymentAllocation = {
  installmentId: string;
  installmentNumber: number;
  interestPaid: Decimal;
  principalPaid: Decimal;
};

export type PaymentDistribution = {
  allocations: PaymentAllocation[];
  interestPaid: Decimal;
  principalPaid: Decimal;
  /** Portion of the amount that no installment could absorb. */
  unallocated: Decimal;
};

export type RemainingBalance = {
  principal: Decimal;
  interest: Decimal;
  total: Decimal;
};

function pendingInterest(i: InstallmentBalance): Decimal {
  return maxMoney(toDecimal(i.interestAmount).minus(toDecimal(i.interestPaid)), ZERO);
}

function pendingPrincipal(i: InstallmentBalance): Decimal {
  return maxMoney(toDecimal(i.principalAmount).minus(toDecimal(i.principalPaid)), ZERO);
}

/**
 * Applies a payment installment by installment (oldest first, or from the chosen
 * one onwards): interest pending is covered first, then principal, and whatever
 * is left flows into the next installment.
 */
export function calculatePaymentDistribution(
  installments: readonly InstallmentBalance[],
  amount: MoneyInput,
  targetInstallmentId?: string | null,
): PaymentDistribution {
  let remaining = roundMoney(amount);
  if (remaining.lte(0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  const ordered = [...installments].sort(
    (a, b) => a.installmentNumber - b.installmentNumber,
  );

  let startIndex = 0;
  if (targetInstallmentId) {
    startIndex = ordered.findIndex((i) => i.id === targetInstallmentId);
    if (startIndex === -1) {
      throw new Error("Target installment does not belong to the loan");
    }
  }

  const allocations: PaymentAllocation[] = [];
  let interestPaid = ZERO;
  let principalPaid = ZERO;

  for (const installment of ordered.slice(startIndex)) {
    if (remaining.lte(0)) break;

    const interest = minMoney(pendingInterest(installment), remaining);
    remaining = remaining.minus(interest);

    const principal = minMoney(pendingPrincipal(installment), remaining);
    remaining = remaining.minus(principal);

    if (interest.lte(0) && principal.lte(0)) continue;

    allocations.push({
      installmentId: installment.id,
      installmentNumber: installment.installmentNumber,
      interestPaid: interest,
      principalPaid: principal,
    });
    interestPaid = interestPaid.plus(interest);
    principalPaid = principalPaid.plus(principal);
  }

  return { allocations, interestPaid, principalPaid, unallocated: remaining };
}

/**
 * "Solo intereses": the amount covers pending interest oldest-first and leaves
 * every principal untouched. Anything beyond the pending interest is reported
 * as unallocated so the caller can reject it.
 */
export function calculateInterestOnlyDistribution(
  installments: readonly InstallmentBalance[],
  amount: MoneyInput,
  targetInstallmentId?: string | null,
): PaymentDistribution {
  let remaining = roundMoney(amount);
  if (remaining.lte(0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  const ordered = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
  let startIndex = 0;
  if (targetInstallmentId) {
    startIndex = ordered.findIndex((i) => i.id === targetInstallmentId);
    if (startIndex === -1) {
      throw new Error("Target installment does not belong to the loan");
    }
  }

  const allocations: PaymentAllocation[] = [];
  let interestPaid = ZERO;
  for (const installment of ordered.slice(startIndex)) {
    if (remaining.lte(0)) break;
    const interest = minMoney(pendingInterest(installment), remaining);
    if (interest.lte(0)) continue;
    remaining = remaining.minus(interest);
    allocations.push({
      installmentId: installment.id,
      installmentNumber: installment.installmentNumber,
      interestPaid: interest,
      principalPaid: ZERO,
    });
    interestPaid = interestPaid.plus(interest);
  }

  return { allocations, interestPaid, principalPaid: ZERO, unallocated: remaining };
}

export function calculateRemainingBalance(
  installments: readonly InstallmentBalance[],
): RemainingBalance {
  const principal = installments.reduce((acc, i) => acc.plus(pendingPrincipal(i)), ZERO);
  const interest = installments.reduce((acc, i) => acc.plus(pendingInterest(i)), ZERO);
  return { principal, interest, total: principal.plus(interest) };
}
