"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { idSchema } from "@/lib/validations/common";
import { markRecurringPaidSchema, recurringExpenseSchema } from "@/lib/validations/recurring";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import { revalidateFinance } from "@/server/revalidate";
import {
  createRecurringExpense,
  deleteRecurringExpense,
  markRecurringPaid,
  setRecurringActive,
  updateRecurringExpense,
} from "@/server/services/recurring";
import { type ActionResult, ok } from "@/types";

export async function createRecurringExpenseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(recurringExpenseSchema, input);
    if (!parsed.ok) return parsed.result;
    const created = await createRecurringExpense(parsed.data);
    revalidateFinance();
    return ok({ id: created.id });
  });
}

export async function updateRecurringExpenseAction(id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(recurringExpenseSchema, input);
    if (!parsed.ok) return parsed.result;
    await updateRecurringExpense(parsedId.data, parsed.data);
    revalidateFinance();
    return ok(undefined);
  });
}

export async function setRecurringActiveAction(id: unknown, active: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsedActive = parseInput(z.boolean(), active);
    if (!parsedActive.ok) return parsedActive.result;
    await setRecurringActive(parsedId.data, parsedActive.data);
    revalidateFinance();
    return ok(undefined);
  });
}

export async function deleteRecurringExpenseAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await deleteRecurringExpense(parsedId.data);
    revalidateFinance();
    return ok(undefined);
  });
}

export async function markRecurringPaidAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<{ nextDueDate: string; chargedToCard: string | null }>> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(markRecurringPaidSchema, input);
    if (!parsed.ok) return parsed.result;
    const result = await markRecurringPaid(parsedId.data, parsed.data);
    revalidateFinance();
    // A card charge changes that card's detail page too. Dynamic-segment patterns must include the route group (see Next's revalidatePath docs).
    revalidatePath("/(dashboard)/finanzas/tarjetas/[id]", "page");
    return ok(result);
  });
}
