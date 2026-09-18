import { describe, expect, it } from "vitest";

import { summarizeInstallments, type SummaryInstallment } from "./loan-summary";

function inst(
  n: number,
  overrides: Partial<SummaryInstallment> = {},
): SummaryInstallment {
  return {
    id: `i${n}`,
    installmentNumber: n,
    dueDate: `2026-0${n}-15`,
    principalAmount: "333333.33",
    interestAmount: "120000.00",
    totalAmount: "453333.33",
    principalPaid: "0",
    interestPaid: "0",
    paidAmount: "0",
    status: "PENDING",
    ...overrides,
  };
}

describe("summarizeInstallments", () => {
  const installments = [
    inst(1, { principalPaid: "333333.33", interestPaid: "120000.00", paidAmount: "453333.33", status: "PAID" }),
    inst(2, { interestPaid: "100000.00", paidAmount: "100000.00", status: "OVERDUE" }),
    inst(3),
  ];

  it("totals scheduled and paid amounts", () => {
    const s = summarizeInstallments(installments);
    expect(s.totalPrincipal.toFixed(2)).toBe("999999.99");
    expect(s.totalInterest.toFixed(2)).toBe("360000.00");
    expect(s.totalAmount.toFixed(2)).toBe("1359999.99");
    expect(s.totalPaid.toFixed(2)).toBe("553333.33");
    expect(s.principalPaid.toFixed(2)).toBe("333333.33");
    expect(s.interestPaid.toFixed(2)).toBe("220000.00");
  });

  it("computes outstanding balances", () => {
    const s = summarizeInstallments(installments);
    expect(s.principalBalance.toFixed(2)).toBe("666666.66");
    expect(s.interestBalance.toFixed(2)).toBe("140000.00");
    expect(s.balance.toFixed(2)).toBe("806666.66");
  });

  it("points to the first unpaid installment as the next one, with its pending amount", () => {
    const s = summarizeInstallments(installments);
    expect(s.nextInstallment).toEqual({
      id: "i2",
      installmentNumber: 2,
      dueDate: "2026-02-15",
      pendingAmount: "353333.33",
      status: "OVERDUE",
    });
  });

  it("counts paid and overdue installments", () => {
    const s = summarizeInstallments(installments);
    expect(s.paidCount).toBe(1);
    expect(s.overdueCount).toBe(1);
  });

  it("has no next installment when everything is paid", () => {
    const s = summarizeInstallments([
      inst(1, { principalPaid: "333333.33", interestPaid: "120000.00", paidAmount: "453333.33", status: "PAID" }),
    ]);
    expect(s.nextInstallment).toBeNull();
    expect(s.balance.toFixed(2)).toBe("0.00");
  });
});
