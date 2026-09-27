"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  accountAdjustmentSchema,
  accountSchema,
  accountTransferSchema,
  assignAccountSchema,
  createAccountSchema,
} from "@/lib/validations/account";
import { idSchema } from "@/lib/validations/common";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import { revalidateFinance } from "@/server/revalidate";
import {
  adjustAccount,
  assignTransactionAccount,
  createAccount,
  deleteAccount,
  setAccountActive,
  transferBetweenAccounts,
  updateAccount,
} from "@/server/services/accounts";
import { type ActionResult, fail, ok } from "@/types";

/**
 * Anything about an account moves a total somewhere: its kind decides the group
 * it adds up in and being inactive takes it out of the total, so every write
 * refreshes the finance screens too.
 */
function revalidateAccounts(id?: string) {
  // revalidateFinance() already covers /finanzas/cuentas; only the detail of one
  // account is outside its list of paths.
  revalidateFinance();
  if (id) revalidatePath(`/finanzas/cuentas/${id}`);
}

/** Account names are unique: the form says so on the field instead of throwing. */
function isDuplicateName(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const DUPLICATE_NAME = "Ya tienes una cuenta con ese nombre";

export async function createAccountAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(createAccountSchema, input);
    if (!parsed.ok) return parsed.result;
    try {
      const created = await createAccount(parsed.data);
      revalidateAccounts();
      return ok({ id: created.id });
    } catch (error) {
      if (isDuplicateName(error)) return fail(DUPLICATE_NAME, { name: [DUPLICATE_NAME] });
      throw error;
    }
  });
}

export async function updateAccountAction(id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(accountSchema, input);
    if (!parsed.ok) return parsed.result;
    try {
      await updateAccount(parsedId.data, parsed.data);
    } catch (error) {
      if (isDuplicateName(error)) return fail(DUPLICATE_NAME, { name: [DUPLICATE_NAME] });
      throw error;
    }
    revalidateAccounts(parsedId.data);
    return ok(undefined);
  });
}

export async function setAccountActiveAction(id: unknown, active: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsedActive = parseInput(z.boolean(), active);
    if (!parsedActive.ok) return parsedActive.result;
    await setAccountActive(parsedId.data, parsedActive.data);
    revalidateAccounts(parsedId.data);
    return ok(undefined);
  });
}

export async function deleteAccountAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await deleteAccount(parsedId.data);
    revalidateAccounts();
    return ok(undefined);
  });
}

export async function transferBetweenAccountsAction(fromId: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, fromId);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(accountTransferSchema, input);
    if (!parsed.ok) return parsed.result;
    await transferBetweenAccounts(parsedId.data, parsed.data);
    revalidateAccounts(parsedId.data);
    revalidatePath(`/finanzas/cuentas/${parsed.data.toAccountId}`);
    return ok(undefined);
  });
}

export async function adjustAccountAction(id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(accountAdjustmentSchema, input);
    if (!parsed.ok) return parsed.result;
    await adjustAccount(parsedId.data, parsed.data);
    revalidateAccounts(parsedId.data);
    return ok(undefined);
  });
}

/** Assigning an old movement also clears it from the "Sin cuenta" filter. */
export async function assignTransactionAccountAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(assignAccountSchema, input);
    if (!parsed.ok) return parsed.result;
    await assignTransactionAccount(parsed.data.transactionId, parsed.data.accountId);
    revalidateAccounts(parsed.data.accountId);
    return ok(undefined);
  });
}
