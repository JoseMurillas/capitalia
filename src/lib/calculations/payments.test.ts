import { describe, expect, it } from "vitest";

import {
  calculatePaymentDistribution,
  calculateRemainingBalance,
  type InstallmentBalance,
} from "./payments";

function installment(
  n: number,
  overrides: Partial<InstallmentBalance> = {},
): InstallmentBalance {
  return {
    id: `inst-${n}`,
    installmentNumber: n,
    principalAmount: "333333.33",
    principalPaid: "0",
    interestAmount: "120000.00",
    interestPaid: "0",
    ...overrides,
  };
}

function summary(result: ReturnType<typeof calculatePaymentDistribution>) {
  return {
    interest: result.interestPaid.toFixed(2),
    principal: result.principalPaid.toFixed(2),
    unallocated: result.unallocated.toFixed(2),
    allocations: result.allocations.map((a) => ({
      id: a.installmentId,
      interest: a.interestPaid.toFixed(2),
      principal: a.principalPaid.toFixed(2),
    })),
  };
}

describe("calculatePaymentDistribution", () => {
  it("pays interest first and the rest goes to principal (user's example)", () => {
    const result = calculatePaymentDistribution(
      [installment(1, { principalAmount: "1000000.00" })],
      200_000,
    );
    expect(summary(result)).toEqual({
      interest: "120000.00",
      principal: "80000.00",
      unallocated: "0.00",
      allocations: [{ id: "inst-1", interest: "120000.00", principal: "80000.00" }],
    });
  });

  it("carries the surplus over to the next installment", () => {
    const result = calculatePaymentDistribution([installment(1), installment(2)], 500_000);
    expect(summary(result)).toEqual({
      interest: "166666.67",
      principal: "333333.33",
      unallocated: "0.00",
      allocations: [
        { id: "inst-1", interest: "120000.00", principal: "333333.33" },
        { id: "inst-2", interest: "46666.67", principal: "0.00" },
      ],
    });
  });

  it("only charges the interest that is still pending on a partially paid installment", () => {
    const result = calculatePaymentDistribution(
      [installment(1, { interestPaid: "100000.00" })],
      30_000,
    );
    expect(summary(result).allocations).toEqual([
      { id: "inst-1", interest: "20000.00", principal: "10000.00" },
    ]);
  });

  it("skips installments that are already fully paid", () => {
    const result = calculatePaymentDistribution(
      [
        installment(1, { interestPaid: "120000.00", principalPaid: "333333.33" }),
        installment(2),
      ],
      10_000,
    );
    expect(summary(result).allocations).toEqual([
      { id: "inst-2", interest: "10000.00", principal: "0.00" },
    ]);
  });

  it("starts from the chosen installment and continues forward, never backwards", () => {
    const result = calculatePaymentDistribution(
      [installment(1), installment(2), installment(3)],
      460_000,
      "inst-2",
    );
    expect(summary(result).allocations).toEqual([
      { id: "inst-2", interest: "120000.00", principal: "333333.33" },
      { id: "inst-3", interest: "6666.67", principal: "0.00" },
    ]);
  });

  it("reports the amount that could not be allocated when the payment exceeds the balance", () => {
    const result = calculatePaymentDistribution([installment(1)], 500_000);
    expect(summary(result)).toMatchObject({
      interest: "120000.00",
      principal: "333333.33",
      unallocated: "46666.67",
    });
  });

  it("rejects a non-positive amount", () => {
    expect(() => calculatePaymentDistribution([installment(1)], 0)).toThrow();
  });

  it("rejects an unknown target installment", () => {
    expect(() => calculatePaymentDistribution([installment(1)], 1_000, "missing")).toThrow();
  });
});

describe("calculateRemainingBalance", () => {
  it("sums pending principal and interest across installments", () => {
    const balance = calculateRemainingBalance([
      installment(1, { interestPaid: "120000.00", principalPaid: "100000.00" }),
      installment(2),
    ]);
    expect(balance.principal.toFixed(2)).toBe("566666.66");
    expect(balance.interest.toFixed(2)).toBe("120000.00");
    expect(balance.total.toFixed(2)).toBe("686666.66");
  });
});
