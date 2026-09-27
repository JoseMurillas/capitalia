"use server";

import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/validations/common";
import { transactionSchema } from "@/lib/validations/transaction";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import { revalidateAccountDetail, revalidateFinance } from "@/server/revalidate";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/server/services/transactions";
import { type ActionResult, ok } from "@/types";

/**
 * A movement changes the balance and the ledger of the account it belongs to,
 * and `revalidateFinance` only knows the list of accounts, not one account's
 * page. Editing has two: the account the movement is leaving and the one it is
 * joining, which is why the old one is read before the write.
 */
function revalidateAccountDetails(...ids: (string | null | undefined)[]) {
  revalidateFinance();
  revalidateAccountDetail(...ids);
}

async function accountOf(transactionId: string): Promise<string | null> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { accountId: true },
  });
  return transaction?.accountId ?? null;
}

export async function createTransactionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(transactionSchema, input);
    if (!parsed.ok) return parsed.result;
    const created = await createTransaction(parsed.data);
    revalidateAccountDetails(parsed.data.accountId);
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
    const previousAccountId = await accountOf(parsedId.data);
    await updateTransaction(parsedId.data, parsed.data);
    revalidateAccountDetails(previousAccountId, parsed.data.accountId);
    return ok(undefined);
  });
}

export async function deleteTransactionAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const accountId = await accountOf(parsedId.data);
    await deleteTransaction(parsedId.data);
    revalidateAccountDetails(accountId);
    return ok(undefined);
  });
}
