import { describe, expect, it } from "vitest";

import { calculateInterestOnlyDistribution } from "./payments";
import { calculatePrincipalPrepayment, type PrepaymentInstallment } from "./prepayment";

function inst(n: number, overrides: Partial<PrepaymentInstallment> = {}): PrepaymentInstallment {
  return {
    id: `i${n}`,
    installmentNumber: n,
    principalAmount: "333333.33",
    principalPaid: "0",
    interestAmount: "120000.00",
    interestPaid: "0",
    status: "PENDING",
    ...overrides,
  };
}

describe("calculateInterestOnlyDistribution", () => {
  it("covers pending interest oldest-first and never touches principal", () => {
    const result = calculateInterestOnlyDistribution([inst(1), inst(2)], 150_000);
    expect(result.allocations.map((a) => [a.installmentId, a.interestPaid.toFixed(2), a.principalPaid.toFixed(2)])).toEqual([
      ["i1", "120000.00", "0.00"],
      ["i2", "30000.00", "0.00"],
    ]);
    expect(result.interestPaid.toFixed(2)).toBe("150000.00");
    expect(result.principalPaid.toFixed(2)).toBe("0.00");
    expect(result.unallocated.toFixed(2)).toBe("0.00");
  });

  it("reports what could not be applied when the amount exceeds pending interest", () => {
    const result = calculateInterestOnlyDistribution([inst(1, { interestPaid: "100000.00" })], 50_000);
    expect(result.interestPaid.toFixed(2)).toBe("20000.00");
    expect(result.unallocated.toFixed(2)).toBe("30000.00");
  });

  it("starts from the chosen installment", () => {
    const result = calculateInterestOnlyDistribution([inst(1), inst(2)], 10_000, "i2");
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].installmentId).toBe("i2");
  });
});

describe("calculatePrincipalPrepayment (abono a capital)", () => {
  const loan = { monthlyInterestRate: 12, installmentFrequency: "MONTHLY" as const, customIntervalDays: null };

  it("spreads the remaining principal evenly and recalculates interest on the new balance", () => {
    // Installment 1 already paid; 666,666.67 of principal outstanding across #2 and #3.
    const pending = [
      inst(2),
      inst(3, { principalAmount: "333333.34" }),
    ];
    const result = calculatePrincipalPrepayment(pending, 400_000, loan);

    // Abono split evenly as principal paid on each pending installment.
    expect(result.allocations.map((a) => [a.installmentId, a.principalPaid.toFixed(2)])).toEqual([
      ["i2", "200000.00"],
      ["i3", "200000.00"],
    ]);
    expect(result.principalPaid.toFixed(2)).toBe("400000.00");
    expect(result.interestPaid.toFixed(2)).toBe("0.00");

    // New outstanding principal 266,666.67 → 133,333.33 + 133,333.34 pending; interest 12 % of 266,666.67.
    expect(result.installments.map((i) => ({
      id: i.id,
      principal: i.principalAmount.toFixed(2),
      principalPaid: i.principalPaid.toFixed(2),
      interest: i.interestAmount.toFixed(2),
      total: i.totalAmount.toFixed(2),
    }))).toEqual([
      { id: "i2", principal: "333333.34", principalPaid: "200000.00", interest: "32000.00", total: "365333.34" },
      { id: "i3", principal: "333333.33", principalPaid: "200000.00", interest: "32000.00", total: "365333.33" },
    ]);
    expect(result.newOutstandingPrincipal.toFixed(2)).toBe("266666.67");
  });

  it("keeps the loan's total principal intact (paid + pending equals the original)", () => {
    const pending = [inst(1), inst(2), inst(3, { principalAmount: "333333.34" })];
    const result = calculatePrincipalPrepayment(pending, 100_000, loan);
    const totalPrincipal = result.installments.reduce((acc, i) => acc + Number(i.principalAmount.toFixed(2)), 0);
    expect(totalPrincipal.toFixed(2)).toBe("1000000.00");
    const totalPending = result.installments.reduce(
      (acc, i) => acc + Number(i.principalAmount.minus(i.principalPaid).toFixed(2)),
      0,
    );
    expect(totalPending.toFixed(2)).toBe("900000.00");
  });

  it("never lowers interest below what was already paid on an installment", () => {
    const pending = [inst(1, { interestPaid: "120000.00" }), inst(2)];
    const result = calculatePrincipalPrepayment(pending, 500_000, loan);
    // New balance 166,666.66 → 20,000 interest; #1 keeps its 120,000 because it was already collected.
    expect(result.installments[0].interestAmount.toFixed(2)).toBe("120000.00");
    expect(result.installments[1].interestAmount.toFixed(2)).toBe("20000.00");
  });

  it("clears all remaining interest when the whole principal is prepaid", () => {
    const pending = [inst(1), inst(2), inst(3, { principalAmount: "333333.34" })];
    const result = calculatePrincipalPrepayment(pending, 1_000_000, loan);
    expect(result.newOutstandingPrincipal.toFixed(2)).toBe("0.00");
    for (const i of result.installments) {
      expect(i.principalAmount.minus(i.principalPaid).toFixed(2)).toBe("0.00");
      expect(i.interestAmount.toFixed(2)).toBe("0.00");
    }
  });

  it("rejects an amount above the outstanding principal or not positive", () => {
    expect(() => calculatePrincipalPrepayment([inst(1)], 400_000, loan)).toThrow();
    expect(() => calculatePrincipalPrepayment([inst(1)], 0, loan)).toThrow();
  });

  it("ignores installments that are already paid", () => {
    const result = calculatePrincipalPrepayment(
      [inst(1, { principalPaid: "333333.33", interestPaid: "120000.00", status: "PAID" }), inst(2)],
      100_000,
      loan,
    );
    expect(result.installments.map((i) => i.id)).toEqual(["i2"]);
  });
});
