import { z } from "zod";

import { idSchema } from "./common";
import { transactionSchema } from "./transaction";

export const INBOX_MAX_MESSAGES = 100;
export const INBOX_BODY_MAX = 5000;

const inboxMessageSchema = z.object({
  /** Id in the source system (Gmail message id, SMS hash). */
  externalId: z.string().trim().min(1).max(200),
  /** ISO 8601 timestamp of the message. */
  receivedAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  sender: z.string().trim().max(200).nullish(),
  subject: z.string().trim().max(300).nullish(),
  text: z.string().trim().min(1).max(INBOX_BODY_MAX * 4).transform((t) => t.slice(0, INBOX_BODY_MAX)),
});

/** Payload accepted by POST /api/inbox. */
export const inboxPayloadSchema = z.object({
  source: z.enum(["email", "sms"]),
  messages: z.array(inboxMessageSchema).min(1).max(INBOX_MAX_MESSAGES),
});

export type InboxPayload = z.infer<typeof inboxPayloadSchema>;

/** Confirming a message turns it into a transaction with these (editable) values. */
export const confirmInboxSchema = z.object({
  messageId: idSchema,
  transaction: transactionSchema,
});

export type ConfirmInboxInput = z.infer<typeof confirmInboxSchema>;
