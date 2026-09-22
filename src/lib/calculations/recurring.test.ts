import { describe, expect, it } from "vitest";

import { advanceDueDate, monthlyEquivalent } from "./recurring";

describe("monthlyEquivalent", () => {
  it("scales each frequency to one month", () => {
    expect(monthlyEquivalent(120_000, "MONTHLY").toFixed(2)).toBe("120000.00");
    expect(monthlyEquivalent(50_000, "BIWEEKLY").toFixed(2)).toBe("100000.00");
    expect(monthlyEquivalent(30_000, "WEEKLY").toFixed(2)).toBe("130000.00");
    expect(monthlyEquivalent(300_000, "QUARTERLY").toFixed(2)).toBe("100000.00");
    expect(monthlyEquivalent(600_000, "SEMIANNUAL").toFixed(2)).toBe("100000.00");
    expect(monthlyEquivalent(1_200_000, "ANNUAL").toFixed(2)).toBe("100000.00");
  });

  it("uses 30-day months for custom intervals", () => {
    expect(monthlyEquivalent(10_000, "CUSTOM", 10).toFixed(2)).toBe("30000.00");
    expect(monthlyEquivalent(90_000, "CUSTOM", 45).toFixed(2)).toBe("60000.00");
  });

  it("rounds half up to two decimals", () => {
    expect(monthlyEquivalent(100, "ANNUAL").toFixed(2)).toBe("8.33");
    expect(monthlyEquivalent(1_000, "WEEKLY").toFixed(2)).toBe("4333.33");
  });

  it("treats a custom interval without days as monthly", () => {
    expect(monthlyEquivalent(50_000, "CUSTOM", null).toFixed(2)).toBe("50000.00");
  });
});

describe("advanceDueDate", () => {
  it("adds whole periods from the scheduled date", () => {
    expect(advanceDueDate("2026-09-15", "WEEKLY")).toBe("2026-09-22");
    expect(advanceDueDate("2026-09-15", "BIWEEKLY")).toBe("2026-09-30");
    expect(advanceDueDate("2026-09-15", "MONTHLY")).toBe("2026-10-15");
    expect(advanceDueDate("2026-09-15", "QUARTERLY")).toBe("2026-12-15");
    expect(advanceDueDate("2026-09-15", "SEMIANNUAL")).toBe("2027-03-15");
    expect(advanceDueDate("2026-09-15", "ANNUAL")).toBe("2027-09-15");
    expect(advanceDueDate("2026-09-15", "CUSTOM", 45)).toBe("2026-10-30");
  });

  it("clamps month arithmetic to the end of shorter months", () => {
    expect(advanceDueDate("2026-01-31", "MONTHLY")).toBe("2026-02-28");
    expect(advanceDueDate("2028-01-31", "MONTHLY")).toBe("2028-02-29");
  });

  it("falls back to monthly when a custom interval has no days", () => {
    expect(advanceDueDate("2026-09-15", "CUSTOM", null)).toBe("2026-10-15");
  });
});
