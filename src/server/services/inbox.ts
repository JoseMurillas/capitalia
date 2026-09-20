import { toDbString } from "@/lib/calculations";
import { fromIsoDate, toIsoDate } from "@/lib/dates";
import { parseBankMessage } from "@/lib/inbox/parse-bank-message";
import { prisma } from "@/lib/prisma";
import type { InboxPayload } from "@/lib/validations/inbox";
import type { TransactionInput } from "@/lib/validations/transaction";

import { NotFoundError, ServiceError } from "../errors";
import { createTransaction } from "./transactions";

const SOURCE_MAP = { email: "EMAIL", sms: "SMS" } as const;

/**
 * Stores incoming bank notifications with the parser's best guess. Messages
 * already seen (same source + externalId) are skipped, so the sender can
 * safely retry or re-deliver.
 */
export async function receiveInboxMessages(payload: InboxPayload): Promise<{ received: number; skipped: number }> {
  const source = SOURCE_MAP[payload.source];
  const existing = await prisma.inboxMessage.findMany({
    where: { source, externalId: { in: payload.messages.map((m) => m.externalId) } },
    select: { externalId: true },
  });
  const seen = new Set(existing.map((m) => m.externalId));
  const fresh = payload.messages.filter((m) => !seen.has(m.externalId));

  if (fresh.length > 0) {
    await prisma.inboxMessage.createMany({
      data: fresh.map((message) => {
        const receivedAt = new Date(message.receivedAt);
        const parsed = parseBankMessage({
          subject: message.subject,
          text: message.text,
          receivedDate: toIsoDate(receivedAt),
        });
        return {
          source,
          externalId: message.externalId,
          receivedAt,
          sender: message.sender ?? null,
          subject: message.subject ?? null,
          body: message.text,
          // Login alerts, security warnings and marketing skip the inbox entirely.
          status: parsed.kind === "NOTICE" ? ("DISCARDED" as const) : ("PENDING" as const),
          amount: parsed.amount !== null ? toDbString(parsed.amount) : null,
          direction: parsed.direction,
          description: parsed.description,
          suggestedDate: fromIsoDate(parsed.transactionDate),
        };
      }),
      skipDuplicates: true,
    });
  }

  return { received: fresh.length, skipped: payload.messages.length - fresh.length };
}

/** Creates the transaction and links it to the message in one transaction. */
export async function confirmInboxMessage(messageId: string, input: TransactionInput) {
  const message = await prisma.inboxMessage.findUnique({ where: { id: messageId }, select: { id: true, status: true } });
  if (!message) throw new NotFoundError("El mensaje");
  if (message.status !== "PENDING") throw new ServiceError("Este mensaje ya fue procesado");

  return prisma.$transaction(async (tx) => {
    const transaction = await createTransaction(input, tx);
    await tx.inboxMessage.update({
      where: { id: messageId },
      data: { status: "CONFIRMED", transactionId: transaction.id },
    });
    return transaction;
  });
}

export async function discardInboxMessage(messageId: string) {
  const message = await prisma.inboxMessage.findUnique({ where: { id: messageId }, select: { id: true, status: true } });
  if (!message) throw new NotFoundError("El mensaje");
  if (message.status !== "PENDING") throw new ServiceError("Este mensaje ya fue procesado");
  await prisma.inboxMessage.update({ where: { id: messageId }, data: { status: "DISCARDED" } });
}

/** Puts a discarded message back in the pending list. */
export async function restoreInboxMessage(messageId: string) {
  const message = await prisma.inboxMessage.findUnique({ where: { id: messageId }, select: { id: true, status: true } });
  if (!message) throw new NotFoundError("El mensaje");
  if (message.status !== "DISCARDED") throw new ServiceError("Solo se pueden restaurar mensajes descartados");
  await prisma.inboxMessage.update({ where: { id: messageId }, data: { status: "PENDING" } });
}

/**
 * Re-runs the parser over every pending message, e.g. after the parser learns
 * a new bank format. Notices are discarded; the rest get fresh suggestions.
 */
export async function reprocessPendingInbox(): Promise<{ updated: number; discarded: number }> {
  const pending = await prisma.inboxMessage.findMany({ where: { status: "PENDING" } });
  let discarded = 0;
  for (const message of pending) {
    const parsed = parseBankMessage({
      subject: message.subject,
      text: message.body,
      receivedDate: toIsoDate(message.receivedAt),
    });
    const isNotice = parsed.kind === "NOTICE";
    if (isNotice) discarded += 1;
    await prisma.inboxMessage.update({
      where: { id: message.id },
      data: {
        status: isNotice ? "DISCARDED" : "PENDING",
        amount: parsed.amount !== null ? toDbString(parsed.amount) : null,
        direction: parsed.direction,
        description: parsed.description,
        suggestedDate: fromIsoDate(parsed.transactionDate),
      },
    });
  }
  return { updated: pending.length - discarded, discarded };
}
