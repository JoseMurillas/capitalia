import "server-only";

import type { InboxDirection, InboxSource, InboxStatus } from "@/generated/prisma/enums";
import { toNumber } from "@/lib/calculations";
import { guessCategory } from "@/lib/categorize";
import { type IsoDate, toIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { TransactionCategoryValue } from "@/lib/validations/transaction";
import { requireSession } from "@/server/auth";

export type InboxMessageDto = {
  id: string;
  source: InboxSource;
  status: InboxStatus;
  receivedAt: string;
  sender: string | null;
  subject: string | null;
  body: string;
  amount: number | null;
  direction: InboxDirection;
  description: string;
  suggestedDate: IsoDate;
  suggestedCategory: TransactionCategoryValue;
  transactionId: string | null;
};

const LIST_LIMIT = 200;

export async function listInboxMessages(status: InboxStatus = "PENDING"): Promise<InboxMessageDto[]> {
  await requireSession();
  const messages = await prisma.inboxMessage.findMany({
    where: { status },
    orderBy: { receivedAt: "desc" },
    take: LIST_LIMIT,
  });

  return messages.map((m) => {
    const type = m.direction === "INCOME" ? "INCOME" : "EXPENSE";
    const description = m.description ?? m.subject ?? "Movimiento";
    return {
      id: m.id,
      source: m.source,
      status: m.status,
      receivedAt: m.receivedAt.toISOString(),
      sender: m.sender,
      subject: m.subject,
      body: m.body,
      amount: m.amount ? toNumber(m.amount) : null,
      direction: m.direction,
      description,
      suggestedDate: m.suggestedDate ? toIsoDate(m.suggestedDate) : toIsoDate(m.receivedAt),
      suggestedCategory: guessCategory(type, `${description} ${m.body}`),
      transactionId: m.transactionId,
    };
  });
}

export async function countPendingInbox(): Promise<number> {
  await requireSession();
  return prisma.inboxMessage.count({ where: { status: "PENDING" } });
}
