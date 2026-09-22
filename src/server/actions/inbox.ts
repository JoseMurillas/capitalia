"use server";

import { revalidatePath } from "next/cache";

import { idSchema } from "@/lib/validations/common";
import { confirmInboxSchema } from "@/lib/validations/inbox";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import { revalidateFinance } from "@/server/revalidate";
import {
  confirmInboxMessage,
  discardInboxMessage,
  reprocessPendingInbox,
  restoreInboxMessage,
} from "@/server/services/inbox";
import { type ActionResult, ok } from "@/types";

function revalidateInbox() {
  revalidatePath("/finanzas/bandeja");
  revalidateFinance();
}

export async function confirmInboxMessageAction(input: unknown): Promise<ActionResult<{ transactionId: string }>> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(confirmInboxSchema, input);
    if (!parsed.ok) return parsed.result;
    const transaction = await confirmInboxMessage(parsed.data.messageId, parsed.data.transaction);
    revalidateInbox();
    return ok({ transactionId: transaction.id });
  });
}

export async function discardInboxMessageAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await discardInboxMessage(parsedId.data);
    revalidateInbox();
    return ok(undefined);
  });
}

export async function restoreInboxMessageAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await restoreInboxMessage(parsedId.data);
    revalidateInbox();
    return ok(undefined);
  });
}

export async function reprocessInboxAction(): Promise<ActionResult<{ updated: number; discarded: number }>> {
  return runAction(async () => {
    await requireSession();
    const result = await reprocessPendingInbox();
    revalidateInbox();
    return ok(result);
  });
}
