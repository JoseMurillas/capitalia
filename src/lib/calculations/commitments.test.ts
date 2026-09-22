import { describe, expect, it } from "vitest";

import { buildMonthPlan, commitmentStatus, filterUpcoming, isAlertActive } from "./commitments";

const TODAY = "2026-09-21";

describe("commitmentStatus", () => {
  it("classifies by distance to the due date and the reminder window", () => {
    expect(commitmentStatus(TODAY, "2026-09-19", 3)).toEqual({ status: "OVERDUE", daysUntilDue: -2 });
    expect(commitmentStatus(TODAY, "2026-09-21", 3)).toEqual({ status: "DUE_TODAY", daysUntilDue: 0 });
    expect(commitmentStatus(TODAY, "2026-09-24", 3)).toEqual({ status: "ALERT", daysUntilDue: 3 });
    expect(commitmentStatus(TODAY, "2026-09-25", 3)).toEqual({ status: "UPCOMING", daysUntilDue: 4 });
  });

  it("uses the reminder window per item", () => {
    expect(commitmentStatus(TODAY, "2026-09-28", 7).status).toBe("ALERT");
    expect(commitmentStatus(TODAY, "2026-09-28", 1).status).toBe("UPCOMING");
    expect(commitmentStatus(TODAY, "2026-09-22", 0).status).toBe("UPCOMING");
  });

  it("marks overdue, today and alert as active alerts", () => {
    expect(isAlertActive("OVERDUE")).toBe(true);
    expect(isAlertActive("DUE_TODAY")).toBe(true);
    expect(isAlertActive("ALERT")).toBe(true);
    expect(isAlertActive("UPCOMING")).toBe(false);
  });
});

describe("buildMonthPlan", () => {
  const recurring = [
    { amount: 1_200_000, nextDueDate: "2026-09-25", paymentMethod: "BANK_TRANSFER", frequency: "MONTHLY" as const, category: "HOUSING", active: true },
    { amount: 120_000, nextDueDate: "2026-09-18", paymentMethod: "CASH", frequency: "MONTHLY" as const, category: "SERVICES", active: true }, // overdue → still pending
    { amount: 25_000, nextDueDate: "2026-09-27", paymentMethod: "CREDIT_CARD", frequency: "MONTHLY" as const, category: "SUBSCRIPTIONS", active: true }, // card → not cash
    { amount: 900_000, nextDueDate: "2026-10-05", paymentMethod: "BANK_TRANSFER", frequency: "MONTHLY" as const, category: "DEBT", active: true }, // next month
    { amount: 1_200_000, nextDueDate: "2027-01-10", paymentMethod: "BANK_TRANSFER", frequency: "ANNUAL" as const, category: "INSURANCE", active: true },
    { amount: 80_000, nextDueDate: "2026-09-22", paymentMethod: "CASH", frequency: "MONTHLY" as const, category: "HEALTH", active: false }, // paused
  ];
  const cards = [
    { paymentAmount: 650_000, minimumPayment: 200_000, nextPaymentDate: "2026-09-30", active: true },
    { paymentAmount: null, minimumPayment: 150_000, nextPaymentDate: "2026-09-28", active: true },
    { paymentAmount: null, minimumPayment: null, nextPaymentDate: "2026-09-29", active: true },
    { paymentAmount: 400_000, minimumPayment: 100_000, nextPaymentDate: "2026-10-03", active: true }, // next month
    { paymentAmount: 300_000, minimumPayment: 100_000, nextPaymentDate: "2026-09-23", active: false }, // inactive
  ];

  const plan = buildMonthPlan({ today: TODAY, monthIncome: 4_000_000, monthExpense: 2_000_000, recurring, cards });

  it("sums cash recurring payments due this month, including overdue ones", () => {
    expect(plan.recurringPending.toFixed(2)).toBe("1320000.00");
  });

  it("sums the suggested card payments due this month", () => {
    expect(plan.cardPending.toFixed(2)).toBe("800000.00");
  });

  it("derives the reserve and the estimated available money", () => {
    expect(plan.reserveNeeded.toFixed(2)).toBe("2120000.00");
    expect(plan.estimatedAvailable.toFixed(2)).toBe("-120000.00");
  });

  it("reports the monthly equivalent of every active recurring expense by category", () => {
    // 1.200.000 + 120.000 + 25.000 + 900.000 + 100.000 (annual / 12)
    expect(plan.monthlyCommitted.toFixed(2)).toBe("2345000.00");
    expect(plan.byCategory.map((c) => [c.category, c.monthly.toFixed(2), c.count])).toEqual([
      ["HOUSING", "1200000.00", 1],
      ["DEBT", "900000.00", 1],
      ["SERVICES", "120000.00", 1],
      ["INSURANCE", "100000.00", 1],
      ["SUBSCRIPTIONS", "25000.00", 1],
    ]);
  });
});

describe("filterUpcoming", () => {
  const items = [
    { name: "Seguro", dueDate: "2026-11-01", daysUntilDue: 41 },
    { name: "Internet", dueDate: "2026-09-24", daysUntilDue: 3 },
    { name: "Arriendo", dueDate: "2026-09-18", daysUntilDue: -3 },
    { name: "Netflix", dueDate: "2026-09-24", daysUntilDue: 3 },
    { name: "Tarjeta", dueDate: "2026-10-21", daysUntilDue: 30 },
  ];

  it("keeps overdue items and those inside the horizon, sorted by date then name", () => {
    expect(filterUpcoming(items, 30).map((i) => i.name)).toEqual(["Arriendo", "Internet", "Netflix", "Tarjeta"]);
    expect(filterUpcoming(items, 7).map((i) => i.name)).toEqual(["Arriendo", "Internet", "Netflix"]);
  });
});
