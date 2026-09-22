import { describe, expect, it } from "vitest";

import {
  cashBoxBalance,
  outstandingPrincipal,
  reassignmentNet,
  runningBalance,
  signedAmount,
} from "./cash-boxes";

describe("signedAmount", () => {
  it("makes outflows negative whatever sign the caller passes", () => {
    expect(signedAmount("WITHDRAWAL", 500_000).toFixed(2)).toBe("-500000.00");
    expect(signedAmount("TRANSFER_OUT", -500_000).toFixed(2)).toBe("-500000.00");
    expect(signedAmount("LOAN_DISBURSEMENT", 1_000_000).toFixed(2)).toBe("-1000000.00");
  });

  it("makes inflows positive whatever sign the caller passes", () => {
    expect(signedAmount("OPENING", 3_000_000).toFixed(2)).toBe("3000000.00");
    expect(signedAmount("DEPOSIT", -3_000_000).toFixed(2)).toBe("3000000.00");
    expect(signedAmount("TRANSFER_IN", 100).toFixed(2)).toBe("100.00");
    expect(signedAmount("LOAN_PAYMENT", 453_333.33).toFixed(2)).toBe("453333.33");
    expect(signedAmount("LOAN_REVERSAL", 300_000).toFixed(2)).toBe("300000.00");
  });

  it("keeps the caller's sign for kinds that go both ways", () => {
    expect(signedAmount("ADJUSTMENT", -12_000).toFixed(2)).toBe("-12000.00");
    expect(signedAmount("ADJUSTMENT", 12_000).toFixed(2)).toBe("12000.00");
    expect(signedAmount("LOAN_REASSIGNMENT", -800_000).toFixed(2)).toBe("-800000.00");
    expect(signedAmount("LOAN_REASSIGNMENT", 800_000).toFixed(2)).toBe("800000.00");
  });
});

describe("cashBoxBalance", () => {
  it("adds the signed amounts of the ledger", () => {
    const balance = cashBoxBalance([
      { amount: 3_000_000 },
      { amount: -1_000_000 },
      { amount: "453333.33" },
      { amount: -500_000 },
    ]);
    expect(balance.toFixed(2)).toBe("1953333.33");
  });

  it("is zero for an empty ledger", () => {
    expect(cashBoxBalance([]).toFixed(2)).toBe("0.00");
  });
});

describe("outstandingPrincipal", () => {
  it("sums the principal still owed, skipping cancelled loans", () => {
    const total = outstandingPrincipal([
      { principalAmount: 1_000_000, principalPaid: 400_000, status: "ACTIVE" },
      { principalAmount: 2_000_000, principalPaid: 2_000_000, status: "PAID" },
      { principalAmount: 500_000, principalPaid: 0, status: "OVERDUE" },
      { principalAmount: 300_000, principalPaid: 0, status: "CANCELLED" },
    ]);
    expect(total.toFixed(2)).toBe("1100000.00");
  });

  it("never goes negative when a loan was overpaid in principal", () => {
    expect(
      outstandingPrincipal([{ principalAmount: 100_000, principalPaid: 120_000, status: "ACTIVE" }]).toFixed(2),
    ).toBe("0.00");
  });
});

describe("reassignmentNet", () => {
  it("is what the old box actually put in: principal minus what came back", () => {
    expect(reassignmentNet(1_000_000, 0).toFixed(2)).toBe("1000000.00");
    expect(reassignmentNet(1_000_000, 400_000).toFixed(2)).toBe("600000.00");
  });

  it("is negative when the loan already returned more than its principal", () => {
    expect(reassignmentNet(1_000_000, 1_360_000).toFixed(2)).toBe("-360000.00");
  });
});

describe("runningBalance", () => {
  it("annotates each movement with the balance after it", () => {
    const rows = runningBalance([
      { id: "a", amount: 3_000_000 },
      { id: "b", amount: -1_000_000 },
      { id: "c", amount: 120_000 },
    ]);
    expect(rows.map((r) => [r.id, r.balance.toFixed(2)])).toEqual([
      ["a", "3000000.00"],
      ["b", "2000000.00"],
      ["c", "2120000.00"],
    ]);
  });
});
