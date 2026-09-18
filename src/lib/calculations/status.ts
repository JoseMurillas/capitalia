import type { IsoDate } from "@/lib/dates";

import { type MoneyInput, toDecimal } from "./money";

export type InstallmentStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
export type LoanStatus = "ACTIVE" | "PAID" | "OVERDUE" | "CANCELLED";

export type InstallmentStatusInput = {
  totalAmount: MoneyInput;
  paidAmount: MoneyInput;
  dueDate: IsoDate;
};

export function isInstallmentPaid(input: Pick<InstallmentStatusInput, "totalAmount" | "paidAmount">): boolean {
  return toDecimal(input.paidAmount).gte(toDecimal(input.totalAmount));
}

export function resolveInstallmentStatus(
  input: InstallmentStatusInput,
  today: IsoDate,
): InstallmentStatus {
  if (isInstallmentPaid(input)) return "PAID";
  // ISO dates compare correctly as strings.
  if (input.dueDate < today) return "OVERDUE";
  return toDecimal(input.paidAmount).gt(0) ? "PARTIAL" : "PENDING";
}

export function resolveLoanStatus(
  installmentStatuses: readonly InstallmentStatus[],
  currentStatus: LoanStatus,
): LoanStatus {
  if (currentStatus === "CANCELLED") return "CANCELLED";
  if (installmentStatuses.length > 0 && installmentStatuses.every((s) => s === "PAID")) {
    return "PAID";
  }
  if (installmentStatuses.some((s) => s === "OVERDUE")) return "OVERDUE";
  return "ACTIVE";
}
