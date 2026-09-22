import { describe, expect, it } from "vitest";

import {
  applyPayment,
  cardAvailable,
  cardUtilization,
  installmentsThisMonth,
  planRemaining,
  suggestedPayment,
} from "./credit-cards";

describe("cardAvailable / cardUtilization", () => {
  it("derives available credit and utilisation percentage", () => {
    expect(cardAvailable(5_000_000, 2_000_000).toFixed(2)).toBe("3000000.00");
    expect(cardUtilization(5_000_000, 2_000_000)).toBe(40);
  });

  it("never reports negative available credit but does report over-limit utilisation", () => {
    expect(cardAvailable(1_000_000, 1_250_000).toFixed(2)).toBe("0.00");
    expect(cardUtilization(1_000_000, 1_250_000)).toBe(125);
  });

  it("rounds utilisation to one decimal and handles a zero limit", () => {
    expect(cardUtilization(3_000_000, 1_000_000)).toBe(33.3);
    expect(cardUtilization(0, 100)).toBe(0);
  });
});

describe("suggestedPayment", () => {
  it("prefers the planned amount, then the minimum, then zero", () => {
    expect(suggestedPayment(650_000, 120_000).toFixed(2)).toBe("650000.00");
    expect(suggestedPayment(null, 120_000).toFixed(2)).toBe("120000.00");
    expect(suggestedPayment(null, null).toFixed(2)).toBe("0.00");
  });
});

describe("planRemaining / installmentsThisMonth", () => {
  it("computes remaining installments and amount", () => {
    const result = planRemaining({ installments: 12, paidInstallments: 4, installmentAmount: 150_000 });
    expect(result.remainingInstallments).toBe(8);
    expect(result.remainingAmount.toFixed(2)).toBe("1200000.00");
    expect(result.finished).toBe(false);
  });

  it("marks a plan finished when every installment is paid", () => {
    const result = planRemaining({ installments: 3, paidInstallments: 3, installmentAmount: 100 });
    expect(result.remainingInstallments).toBe(0);
    expect(result.remainingAmount.toFixed(2)).toBe("0.00");
    expect(result.finished).toBe(true);
  });

  it("sums only the active plans", () => {
    const total = installmentsThisMonth([
      { installments: 12, paidInstallments: 4, installmentAmount: 150_000 },
      { installments: 3, paidInstallments: 3, installmentAmount: 100_000 },
      { installments: 6, paidInstallments: 0, installmentAmount: "80000.50" },
    ]);
    expect(total.toFixed(2)).toBe("230000.50");
  });
});

describe("applyPayment", () => {
  it("reduces the balance and floors it at zero", () => {
    expect(applyPayment(500_000, 200_000).toFixed(2)).toBe("300000.00");
    expect(applyPayment(100_000, 150_000).toFixed(2)).toBe("0.00");
  });
});
