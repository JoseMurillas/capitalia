"use server";

import { idSchema } from "@/lib/validations/common";
import { transactionSchema } from "@/lib/validations/transaction";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import { revalidateFinance } from "@/server/revalidate";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/server/services/transactions";
import { type ActionResult, ok } from "@/types";

export async function createTransactionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(transactionSchema, input);
    if (!parsed.ok) return parsed.result;
    const created = await createTransaction(parsed.data);
    revalidateFinance();
    return ok({ id: created.id });
  });
}

export async function updateTransactionAction(id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(transactionSchema, input);
    if (!parsed.ok) return parsed.result;
    await updateTransaction(parsedId.data, parsed.data);
    revalidateFinance();
    return ok(undefined);
  });
}

export async function deleteTransactionAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await deleteTransaction(parsedId.data);
    revalidateFinance();
    return ok(undefined);
  });
}
