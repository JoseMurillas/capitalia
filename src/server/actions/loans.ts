"use server";

import { revalidatePath } from "next/cache";

import { calculateLoanDueDate, calculateLoanTotals, generateSchedule, toNumber } from "@/lib/calculations";
import type { IsoDate } from "@/lib/dates";
import { reassignLoanSchema } from "@/lib/validations/cash-box";
import { idSchema, optionalTrimmed } from "@/lib/validations/common";
import { loanSchema } from "@/lib/validations/loan";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import { reassignLoanCashBox } from "@/server/services/cash-boxes";
import { cancelLoan, createLoan, deleteLoan, updateLoanNotes } from "@/server/services/loans";
import { type ActionResult, ok } from "@/types";

export type SchedulePreview = {
  installments: {
    installmentNumber: number;
    dueDate: IsoDate;
    principalAmount: number;
    interestAmount: number;
    totalAmount: number;
  }[];
  totalPrincipal: number;
  totalInterest: number;
  totalAmount: number;
  dueDate: IsoDate;
};

function revalidateLoans(id?: string, personId?: string) {
  revalidatePath("/prestamos");
  revalidatePath("/prestamos/cajas");
  revalidatePath("/(dashboard)/prestamos/cajas/[id]", "page");
  revalidatePath("/pagos");
  revalidatePath("/dashboard");
  revalidatePath("/reportes");
  revalidatePath("/finanzas");
  if (id) revalidatePath(`/prestamos/${id}`);
  if (personId) revalidatePath(`/personas/${personId}`);
  revalidatePath("/personas");
}

/** Read-only: computes the schedule the form shows before the loan is saved. */
export async function previewScheduleAction(input: unknown): Promise<ActionResult<SchedulePreview>> {
  return runAction(async () => {
    await requireSession();
    // personId is validated on save; the preview only needs the financial fields.
    const parsed = parseInput(
      loanSchema.safeExtend({ personId: idSchema.catch("preview"), cashBoxId: idSchema.catch("preview") }),
      input,
    );
    if (!parsed.ok) return parsed.result;

    const params = {
      principalAmount: parsed.data.principalAmount,
      monthlyInterestRate: parsed.data.monthlyInterestRate,
      interestType: parsed.data.interestType,
      numberOfInstallments: parsed.data.numberOfInstallments,
      installmentFrequency: parsed.data.installmentFrequency,
      customIntervalDays: parsed.data.customIntervalDays,
      startDate: parsed.data.startDate,
    };
    const schedule = generateSchedule(params);
    const totals = calculateLoanTotals(schedule);

    return ok({
      installments: schedule.map((i) => ({
        installmentNumber: i.installmentNumber,
        dueDate: i.dueDate,
        principalAmount: toNumber(i.principalAmount),
        interestAmount: toNumber(i.interestAmount),
        totalAmount: toNumber(i.totalAmount),
      })),
      totalPrincipal: toNumber(totals.totalPrincipal),
      totalInterest: toNumber(totals.totalInterest),
      totalAmount: toNumber(totals.totalAmount),
      dueDate: calculateLoanDueDate(params),
    });
  });
}

export async function createLoanAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(loanSchema, input);
    if (!parsed.ok) return parsed.result;
    const loan = await createLoan(parsed.data);
    revalidateLoans(loan.id, parsed.data.personId);
    return ok({ id: loan.id });
  });
}

export async function updateLoanNotesAction(id: unknown, notes: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsedNotes = parseInput(optionalTrimmed(1000), notes ?? "");
    if (!parsedNotes.ok) return parsedNotes.result;
    await updateLoanNotes(parsedId.data, parsedNotes.data);
    revalidateLoans(parsedId.data);
    return ok(undefined);
  });
}

export async function cancelLoanAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await cancelLoan(parsedId.data);
    revalidateLoans(parsedId.data);
    return ok(undefined);
  });
}

export async function deleteLoanAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await deleteLoan(parsedId.data);
    revalidateLoans(parsedId.data);
    return ok(undefined);
  });
}

export async function reassignLoanCashBoxAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<{ net: number; fromName: string; toName: string }>> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(reassignLoanSchema, input);
    if (!parsed.ok) return parsed.result;
    const result = await reassignLoanCashBox(parsedId.data, parsed.data.cashBoxId);
    revalidateLoans(parsedId.data);
    return ok(result);
  });
}
