import { describe, expect, it } from "vitest";

import {
  addDaysIso,
  addMonthsIso,
  daysBetweenIso,
  endOfMonthIso,
  formatDate,
  fromIsoDate,
  isIsoDate,
  monthKey,
  startOfMonthIso,
  toIsoDate,
} from "./dates";

describe("ISO date helpers", () => {
  it("round-trips through the UTC-midnight Date Prisma uses for @db.Date", () => {
    const date = fromIsoDate("2026-09-18");
    expect(date.toISOString()).toBe("2026-09-18T00:00:00.000Z");
    expect(toIsoDate(date)).toBe("2026-09-18");
  });

  it("validates the yyyy-MM-dd shape and real calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("18/09/2026")).toBe(false);
    expect(isIsoDate(20260918)).toBe(false);
  });

  it("adds months clamping to the end of shorter months", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2026-01-31", 3)).toBe("2026-04-30");
    expect(addMonthsIso("2026-11-15", 2)).toBe("2027-01-15");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysIso("2026-12-25", 10)).toBe("2027-01-04");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("computes month boundaries and keys", () => {
    expect(startOfMonthIso("2026-09-18")).toBe("2026-09-01");
    expect(endOfMonthIso("2026-02-10")).toBe("2026-02-28");
    expect(monthKey("2026-09-18")).toBe("2026-09");
  });

  it("counts whole days between dates, negative when going backwards", () => {
    expect(daysBetweenIso("2026-09-10", "2026-09-18")).toBe(8);
    expect(daysBetweenIso("2026-09-18", "2026-09-10")).toBe(-8);
  });

  it("formats in Spanish without shifting the day", () => {
    expect(formatDate("2026-09-01")).toMatch(/^1 sept? 2026$/);
  });
});
