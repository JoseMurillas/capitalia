import { describe, expect, it } from "vitest";

import {
  accountBalance,
  accountsTotal,
  cashBoxMirrorAmount,
  summarizeAccounts,
  transactionLedgerAmount,
  transferLegs,
} from "./accounts";
import { toDecimal, toNumber } from "./money";

describe("accountBalance", () => {
  it("is zero for an account with nothing in it", () => {
    expect(toNumber(accountBalance({ movements: [], transactions: [] }))).toBe(0);
  });

  it("adds the signed movements", () => {
    const balance = accountBalance({
      movements: [{ amount: 1_000_000 }, { amount: -250_000 }],
      transactions: [],
    });
    expect(toNumber(balance)).toBe(750_000);
  });

  it("adds income and subtracts expenses", () => {
    const balance = accountBalance({
      movements: [{ amount: 500_000 }],
      transactions: [
        { type: "INCOME", amount: 2_000_000 },
        { type: "EXPENSE", amount: 350_000 },
        { type: "EXPENSE", amount: 150_000 },
      ],
    });
    expect(toNumber(balance)).toBe(2_000_000);
  });

  it("can go negative, because a missing assignment is not a reason to lie", () => {
    const balance = accountBalance({
      movements: [],
      transactions: [{ type: "EXPENSE", amount: 80_000 }],
    });
    expect(toNumber(balance)).toBe(-80_000);
  });

  it("keeps the cents exact", () => {
    const balance = accountBalance({
      movements: [{ amount: "0.10" }, { amount: "0.20" }],
      transactions: [],
    });
    expect(toNumber(balance)).toBe(0.3);
  });
});

describe("accountsTotal", () => {
  it("adds every balance it is given", () => {
    expect(toNumber(accountsTotal([1_240_000, 3_500_000, 180_000]))).toBe(4_920_000);
  });

  it("is zero with no accounts", () => {
    expect(toNumber(accountsTotal([]))).toBe(0);
  });
});

describe("summarizeAccounts", () => {
  it("leaves an inactive account out of the total and out of its group", () => {
    const summary = summarizeAccounts([
      { kind: "CASH", active: true, balance: 180_000 },
      { kind: "SAVINGS", active: false, balance: 4_000_000 },
    ]);
    expect(summary.total).toBe(180_000);
    expect(summary.byKind).toEqual([{ kind: "CASH", total: 180_000, count: 1 }]);
  });

  it("adds two accounts of the same kind into a single group", () => {
    const summary = summarizeAccounts([
      { kind: "WALLET", active: true, balance: 120_000 },
      { kind: "WALLET", active: true, balance: 80_000 },
      { kind: "DEBIT", active: true, balance: 1_000_000 },
    ]);
    expect(summary.total).toBe(1_200_000);
    expect(summary.byKind).toEqual([
      { kind: "WALLET", total: 200_000, count: 2 },
      { kind: "DEBIT", total: 1_000_000, count: 1 },
    ]);
  });

  it("is zero with no accounts, and no groups either", () => {
    expect(summarizeAccounts([])).toEqual({ total: 0, byKind: [] });
  });

  it("keeps a negative balance in the total instead of hiding it", () => {
    const summary = summarizeAccounts([
      { kind: "DEBIT", active: true, balance: 500_000 },
      { kind: "CASH", active: true, balance: -80_000 },
    ]);
    expect(summary.total).toBe(420_000);
    expect(summary.byKind).toEqual([
      { kind: "DEBIT", total: 500_000, count: 1 },
      { kind: "CASH", total: -80_000, count: 1 },
    ]);
  });
});

describe("accountsTotal", () => {
  it("lets an overdrawn account subtract instead of hiding it", () => {
    // A clamp here would overstate what you have while an account is overdrawn.
    expect(accountsTotal([500_000, -200_000]).toFixed(2)).toBe("300000.00");
    expect(accountsTotal([-80_000]).toFixed(2)).toBe("-80000.00");
  });

  it("keeps the cents exact across many balances", () => {
    expect(accountsTotal(["0.10", "0.20"]).toFixed(2)).toBe("0.30");
  });
});

describe("cashBoxMirrorAmount", () => {
  it("takes money out of the account when it goes into a box", () => {
    expect(cashBoxMirrorAmount("DEPOSIT", 1_000_000).toFixed(2)).toBe("-1000000.00");
  });

  it("puts it back when it comes out of a box", () => {
    expect(cashBoxMirrorAmount("WITHDRAWAL", 500_000).toFixed(2)).toBe("500000.00");
  });
});

describe("transferLegs", () => {
  it("takes from one side exactly what it gives the other", () => {
    const legs = transferLegs(250_000);
    expect(legs.from.toFixed(2)).toBe("-250000.00");
    expect(legs.to.toFixed(2)).toBe("250000.00");
    expect(legs.from.plus(legs.to).toFixed(2)).toBe("0.00");
  });

  it("keeps the cents exact, so a transfer never invents or loses money", () => {
    const legs = transferLegs("0.01");
    expect(legs.from.plus(legs.to).toFixed(2)).toBe("0.00");
  });
});

describe("transactionLedgerAmount", () => {
  it("adds an income and subtracts an expense", () => {
    expect(transactionLedgerAmount("INCOME", 250_000).toFixed(2)).toBe("250000.00");
    expect(transactionLedgerAmount("EXPENSE", 250_000).toFixed(2)).toBe("-250000.00");
  });

  it("is the sign accountBalance uses, so the header and the ledger cannot disagree", () => {
    // The detail screen folds the rows one by one while the header sums them all
    // at once. They agree only while both flip the sign the same way.
    const movements = [{ amount: "2000000.00" }];
    const transactions = [
      { type: "EXPENSE" as const, amount: "1500000.00" },
      { type: "INCOME" as const, amount: "250000.00" },
    ];
    const header = accountBalance({ movements, transactions });
    const folded = [
      ...movements.map((m) => toDecimal(m.amount)),
      ...transactions.map((t) => transactionLedgerAmount(t.type, t.amount)),
    ].reduce((total, amount) => total.plus(amount), toDecimal(0));
    expect(folded.toFixed(2)).toBe(header.toFixed(2));
  });
});
