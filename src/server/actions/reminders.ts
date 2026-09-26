"use server";

import { revalidatePath } from "next/cache";

import { idSchema } from "@/lib/validations/common";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import { type ReminderRunResult, retryReminder, runReminders } from "@/server/services/reminders";
import { type ActionResult, ok } from "@/types";

export async function retryReminderAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await retryReminder(parsedId.data);
    revalidatePath("/prestamos/recordatorios");
    return ok(undefined);
  });
}

/** Lets the user fire today's run from the screen instead of waiting for the cron. */
export async function runRemindersAction(): Promise<ActionResult<ReminderRunResult>> {
  return runAction(async () => {
    await requireSession();
    const result = await runReminders();
    revalidatePath("/prestamos/recordatorios");
    return ok(result);
  });
}
