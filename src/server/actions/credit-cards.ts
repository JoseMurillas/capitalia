"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { idSchema } from "@/lib/validations/common";
import {
  creditCardPaymentSchema,
  creditCardSchema,
  creditCardStatementSchema,
  installmentPlanSchema,
} from "@/lib/validations/credit-card";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import { revalidateFinance } from "@/server/revalidate";
import {
  createCreditCard,
  createInstallmentPlan,
  deleteCreditCard,
  deleteInstallmentPlan,
  registerCardPayment,
  setCreditCardActive,
  updateCardStatement,
  updateCreditCard,
  updateInstallmentPlan,
} from "@/server/services/credit-cards";
import { type ActionResult, ok } from "@/types";

function revalidateCard(id: string) {
  revalidateFinance();
  revalidatePath(`/finanzas/tarjetas/${id}`);
}

export async function createCreditCardAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(creditCardSchema, input);
    if (!parsed.ok) return parsed.result;
    const created = await createCreditCard(parsed.data);
    revalidateFinance();
    return ok({ id: created.id });
  });
}

export async function updateCreditCardAction(id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(creditCardSchema, input);
    if (!parsed.ok) return parsed.result;
    await updateCreditCard(parsedId.data, parsed.data);
    revalidateCard(parsedId.data);
    return ok(undefined);
  });
}

export async function setCreditCardActiveAction(id: unknown, active: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsedActive = parseInput(z.boolean(), active);
    if (!parsedActive.ok) return parsedActive.result;
    await setCreditCardActive(parsedId.data, parsedActive.data);
    revalidateCard(parsedId.data);
    return ok(undefined);
  });
}

export async function deleteCreditCardAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await deleteCreditCard(parsedId.data);
    revalidateFinance();
    return ok(undefined);
  });
}

export async function updateCardStatementAction(id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(creditCardStatementSchema, input);
    if (!parsed.ok) return parsed.result;
    await updateCardStatement(parsedId.data, parsed.data);
    revalidateCard(parsedId.data);
    return ok(undefined);
  });
}

export async function registerCardPaymentAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<{ transactionId: string; newBalance: number }>> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(creditCardPaymentSchema, input);
    if (!parsed.ok) return parsed.result;
    const result = await registerCardPayment(parsedId.data, parsed.data);
    revalidateCard(parsedId.data);
    return ok(result);
  });
}

export async function createInstallmentPlanAction(cardId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireSession();
    const parsedCard = parseInput(idSchema, cardId);
    if (!parsedCard.ok) return parsedCard.result;
    const parsed = parseInput(installmentPlanSchema, input);
    if (!parsed.ok) return parsed.result;
    const created = await createInstallmentPlan(parsedCard.data, parsed.data);
    revalidateCard(parsedCard.data);
    return ok({ id: created.id });
  });
}

export async function updateInstallmentPlanAction(cardId: unknown, id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedCard = parseInput(idSchema, cardId);
    if (!parsedCard.ok) return parsedCard.result;
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(installmentPlanSchema, input);
    if (!parsed.ok) return parsed.result;
    await updateInstallmentPlan(parsedCard.data, parsedId.data, parsed.data);
    revalidateCard(parsedCard.data);
    return ok(undefined);
  });
}

export async function deleteInstallmentPlanAction(cardId: unknown, id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedCard = parseInput(idSchema, cardId);
    if (!parsedCard.ok) return parsedCard.result;
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await deleteInstallmentPlan(parsedCard.data, parsedId.data);
    revalidateCard(parsedCard.data);
    return ok(undefined);
  });
}
