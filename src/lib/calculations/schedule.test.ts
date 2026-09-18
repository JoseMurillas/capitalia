import { describe, expect, it } from "vitest";

import {
  calculateLoanDueDate,
  calculateLoanTotals,
  generateSchedule,
  type ScheduleParams,
} from "./schedule";

const base: ScheduleParams = {
  principalAmount: 1_000_000,
  monthlyInterestRate: 12,
  interestType: "SIMPLE",
  numberOfInstallments: 3,
  installmentFrequency: "MONTHLY",
  startDate: "2026-01-15",
};

function fixed(schedule: ReturnType<typeof generateSchedule>) {
  return schedule.map((i) => ({
    n: i.installmentNumber,
    due: i.dueDate,
    principal: i.principalAmount.toFixed(2),
    interest: i.interestAmount.toFixed(2),
    total: i.totalAmount.toFixed(2),
  }));
}

describe("generateSchedule (SIMPLE = flat interest on the initial principal)", () => {
  it("charges the full monthly interest on every installment and splits the principal evenly", () => {
    expect(fixed(generateSchedule(base))).toEqual([
      { n: 1, due: "2026-02-15", principal: "333333.33", interest: "120000.00", total: "453333.33" },
      { n: 2, due: "2026-03-15", principal: "333333.33", interest: "120000.00", total: "453333.33" },
      { n: 3, due: "2026-04-15", principal: "333333.34", interest: "120000.00", total: "453333.34" },
    ]);
  });

  it("produces the user's one-month example: 1.000.000 at 12 % → 1.120.000", () => {
    const [only] = generateSchedule({ ...base, numberOfInstallments: 1 });
    expect(only.totalAmount.toFixed(2)).toBe("1120000.00");
  });

  it("keeps month-end dates anchored to the start date", () => {
    const dates = generateSchedule({ ...base, startDate: "2026-01-31" }).map((i) => i.dueDate);
    expect(dates).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("uses 15-day steps and half the monthly interest for BIWEEKLY", () => {
    const schedule = generateSchedule({ ...base, installmentFrequency: "BIWEEKLY", numberOfInstallments: 2 });
    expect(schedule.map((i) => i.dueDate)).toEqual(["2026-01-30", "2026-02-14"]);
    expect(schedule[0].interestAmount.toFixed(2)).toBe("60000.00");
  });

  it("uses 7-day steps and a quarter of the monthly interest for WEEKLY", () => {
    const schedule = generateSchedule({ ...base, installmentFrequency: "WEEKLY", numberOfInstallments: 2 });
    expect(schedule.map((i) => i.dueDate)).toEqual(["2026-01-22", "2026-01-29"]);
    expect(schedule[0].interestAmount.toFixed(2)).toBe("30000.00");
  });

  it("prorates CUSTOM intervals by days over 30", () => {
    const schedule = generateSchedule({
      ...base,
      installmentFrequency: "CUSTOM",
      customIntervalDays: 10,
      numberOfInstallments: 2,
    });
    expect(schedule.map((i) => i.dueDate)).toEqual(["2026-01-25", "2026-02-04"]);
    expect(schedule[0].interestAmount.toFixed(2)).toBe("40000.00");
  });

  it("rejects a non-positive number of installments", () => {
    expect(() => generateSchedule({ ...base, numberOfInstallments: 0 })).toThrow();
  });
});

describe("calculateLoanDueDate", () => {
  it("is the due date of the last installment", () => {
    expect(calculateLoanDueDate(base)).toBe("2026-04-15");
  });
});

describe("calculateLoanTotals", () => {
  it("sums principal, interest and total across the schedule", () => {
    const totals = calculateLoanTotals(generateSchedule(base));
    expect(totals.totalPrincipal.toFixed(2)).toBe("1000000.00");
    expect(totals.totalInterest.toFixed(2)).toBe("360000.00");
    expect(totals.totalAmount.toFixed(2)).toBe("1360000.00");
  });
});
