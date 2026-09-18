import { describe, expect, it } from "vitest";

import { resolveInstallmentStatus, resolveLoanStatus } from "./status";

const TODAY = "2026-09-18";

describe("resolveInstallmentStatus", () => {
  it("is PAID once the paid amount covers the total, even if it was late", () => {
    expect(
      resolveInstallmentStatus({ totalAmount: "100", paidAmount: "100.00", dueDate: "2026-01-01" }, TODAY),
    ).toBe("PAID");
  });

  it("is PARTIAL when something was paid and the due date has not passed", () => {
    expect(
      resolveInstallmentStatus({ totalAmount: "100", paidAmount: "40", dueDate: TODAY }, TODAY),
    ).toBe("PARTIAL");
  });

  it("is OVERDUE when not fully paid and the due date is in the past", () => {
    expect(
      resolveInstallmentStatus({ totalAmount: "100", paidAmount: "40", dueDate: "2026-09-17" }, TODAY),
    ).toBe("OVERDUE");
    expect(
      resolveInstallmentStatus({ totalAmount: "100", paidAmount: "0", dueDate: "2026-09-17" }, TODAY),
    ).toBe("OVERDUE");
  });

  it("is PENDING when nothing was paid and the due date is today or later", () => {
    expect(
      resolveInstallmentStatus({ totalAmount: "100", paidAmount: "0", dueDate: TODAY }, TODAY),
    ).toBe("PENDING");
  });
});

describe("resolveLoanStatus", () => {
  it("is PAID when every installment is paid", () => {
    expect(resolveLoanStatus(["PAID", "PAID"], "ACTIVE")).toBe("PAID");
  });

  it("is OVERDUE when any installment is overdue", () => {
    expect(resolveLoanStatus(["PAID", "OVERDUE", "PENDING"], "ACTIVE")).toBe("OVERDUE");
  });

  it("is ACTIVE otherwise", () => {
    expect(resolveLoanStatus(["PAID", "PARTIAL", "PENDING"], "OVERDUE")).toBe("ACTIVE");
  });

  it("never changes a cancelled loan", () => {
    expect(resolveLoanStatus(["OVERDUE"], "CANCELLED")).toBe("CANCELLED");
  });
});
