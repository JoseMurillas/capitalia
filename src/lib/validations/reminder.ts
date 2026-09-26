import { z } from "zod";

import { optionalTrimmed } from "./common";

export const REMINDER_STATUSES = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const;

export type ReminderStatusValue = (typeof REMINDER_STATUSES)[number];

/** How many reminders one run may send, so a backlog cannot blow Gmail's daily quota. */
export const REMINDER_BATCH_SIZE = 50;

export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  signature: z.string().trim().min(2, { error: "Escribe con qué nombre firmas" }).max(80),
  /** Phone or WhatsApp shown in the email; empty means the line is omitted. */
  contact: optionalTrimmed(80),
});

export type ReminderSettingsInput = z.infer<typeof reminderSettingsSchema>;
