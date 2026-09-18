import { describe, expect, it } from "vitest";

import {
  calculateMonthlyInterest,
  calculatePeriodInterest,
  monthsPerPeriod,
} from "./interest";

describe("calculateMonthlyInterest", () => {
  it("applies the monthly percentage to the principal", () => {
    expect(calculateMonthlyInterest(1_000_000, 12).toFixed(2)).toBe("120000.00");
  });

  it("rounds to cents using half-up", () => {
    // 333333 × 1.5 % = 4999.995 → 5000.00
    expect(calculateMonthlyInterest(333_333, 1.5).toFixed(2)).toBe("5000.00");
  });

  it("accepts string inputs as they come from the database", () => {
    expect(calculateMonthlyInterest("250000.00", "10.000").toFixed(2)).toBe("25000.00");
  });
});

describe("monthsPerPeriod", () => {
  it("maps each frequency to its fraction of a month", () => {
    expect(monthsPerPeriod("MONTHLY").toString()).toBe("1");
    expect(monthsPerPeriod("BIWEEKLY").toString()).toBe("0.5");
    expect(monthsPerPeriod("WEEKLY").toString()).toBe("0.25");
  });

  it("treats CUSTOM as days over 30", () => {
    expect(monthsPerPeriod("CUSTOM", 45).toString()).toBe("1.5");
  });

  it("rejects CUSTOM without an interval", () => {
    expect(() => monthsPerPeriod("CUSTOM")).toThrow();
  });
});

describe("calculatePeriodInterest", () => {
  it("prorates the monthly interest to the period length", () => {
    expect(
      calculatePeriodInterest(1_000_000, 12, "BIWEEKLY").toFixed(2),
    ).toBe("60000.00");
  });
});
