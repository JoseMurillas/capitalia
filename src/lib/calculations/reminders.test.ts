import { describe, expect, it } from "vitest";

import { daysOverdue, reminderDueOn, resendableAs } from "./reminders";

const DUE = "2026-09-25";
const OPEN = { dueDate: DUE, totalAmount: 100_000, paidAmount: 0, loanStatus: "ACTIVE" };

describe("daysOverdue", () => {
  it("counts whole days past the due date and is negative before it", () => {
    expect(daysOverdue("2026-09-26", DUE)).toBe(1);
    expect(daysOverdue("2026-10-03", DUE)).toBe(8);
    expect(daysOverdue(DUE, DUE)).toBe(0);
    expect(daysOverdue("2026-09-24", DUE)).toBe(-1);
  });
});

describe("reminderDueOn", () => {
  it("warns the day before the installment falls due", () => {
    expect(reminderDueOn(OPEN, "2026-09-24")).toEqual({ kind: "BEFORE_DUE", daysOverdue: null });
  });

  it("says nothing two days before, on the due date itself, or any other early day", () => {
    expect(reminderDueOn(OPEN, "2026-09-23")).toBeNull();
    expect(reminderDueOn(OPEN, DUE)).toBeNull();
    expect(reminderDueOn(OPEN, "2026-09-01")).toBeNull();
  });

  it("warns the day after it is due and then once a week", () => {
    expect(reminderDueOn(OPEN, "2026-09-26")).toEqual({ kind: "OVERDUE", daysOverdue: 1 });
    expect(reminderDueOn(OPEN, "2026-10-03")).toEqual({ kind: "OVERDUE", daysOverdue: 8 });
    expect(reminderDueOn(OPEN, "2026-10-10")).toEqual({ kind: "OVERDUE", daysOverdue: 15 });
    expect(reminderDueOn(OPEN, "2026-10-17")).toEqual({ kind: "OVERDUE", daysOverdue: 22 });
  });

  it("stays quiet on the days in between", () => {
    expect(reminderDueOn(OPEN, "2026-09-27")).toBeNull();
    expect(reminderDueOn(OPEN, "2026-10-02")).toBeNull();
    expect(reminderDueOn(OPEN, "2026-10-09")).toBeNull();
  });

  it("never chases a paid installment", () => {
    const paid = { ...OPEN, paidAmount: 100_000 };
    expect(reminderDueOn(paid, "2026-09-24")).toBeNull();
    expect(reminderDueOn(paid, "2026-09-26")).toBeNull();
  });

  it("chases an installment that is only partly paid", () => {
    const partial = { ...OPEN, paidAmount: 40_000 };
    expect(reminderDueOn(partial, "2026-09-26")).toEqual({ kind: "OVERDUE", daysOverdue: 1 });
  });

  it("never chases anything on a cancelled loan", () => {
    const cancelled = { ...OPEN, loanStatus: "CANCELLED" };
    expect(reminderDueOn(cancelled, "2026-09-24")).toBeNull();
    expect(reminderDueOn(cancelled, "2026-09-26")).toBeNull();
  });
});

describe("resendableAs", () => {
  it("resends the eve notice only on the eve", () => {
    expect(resendableAs("BEFORE_DUE", "2026-09-24", DUE)).toBeNull();
    expect(resendableAs("BEFORE_DUE", DUE, DUE)).toBe(false);
    expect(resendableAs("BEFORE_DUE", "2026-10-03", DUE)).toBe(false);
  });

  it("resends the overdue notice with the days late counted today, not when it was written", () => {
    expect(resendableAs("OVERDUE", "2026-09-26", DUE)).toBe(1);
    expect(resendableAs("OVERDUE", "2026-10-04", DUE)).toBe(9);
  });

  it("refuses the overdue notice while the cuota is not yet late", () => {
    expect(resendableAs("OVERDUE", "2026-09-24", DUE)).toBe(false);
    expect(resendableAs("OVERDUE", DUE, DUE)).toBe(false);
  });
});
