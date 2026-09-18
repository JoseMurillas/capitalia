import { describe, expect, it } from "vitest";

import { formatMoney, formatMoneyCompact, formatPercent } from "./format";

describe("formatMoney", () => {
  it("uses Colombian thousands separators with no decimals", () => {
    expect(formatMoney(1_000_000)).toBe("$1.000.000");
    expect(formatMoney(120_000)).toBe("$120.000");
    expect(formatMoney("453333.33")).toBe("$453.333");
  });

  it("prefixes the sign for negative values", () => {
    expect(formatMoney(-120_000)).toBe("-$120.000");
  });

  it("falls back to $0 for invalid input", () => {
    expect(formatMoney(Number.NaN)).toBe("$0");
  });
});

describe("formatMoneyCompact", () => {
  it("abbreviates millions and thousands", () => {
    expect(formatMoneyCompact(1_250_000)).toBe("$1,25M");
    expect(formatMoneyCompact(120_000)).toBe("$120K");
    expect(formatMoneyCompact(950)).toBe("$950");
  });
});

describe("formatPercent", () => {
  it("keeps up to two decimals with a comma", () => {
    expect(formatPercent(12)).toBe("12%");
    expect(formatPercent(2.5)).toBe("2,5%");
  });
});
