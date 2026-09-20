import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { InboxDirection, InboxSource, InboxStatus } from "@/generated/prisma/enums";
import { toNumber } from "@/lib/calculations";
import { guessCategory } from "@/lib/categorize";
import { type IsoDate, toIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { pageCountFor, paginate } from "@/lib/search-params";
import type { TransactionCategoryValue } from "@/lib/validations/transaction";
import { requireSession } from "@/server/auth";
import type { PaginatedResult } from "@/types";

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

export type InboxListParams = {
  status?: InboxStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

const INBOX_PAGE_SIZE = 20;

export async function listInboxMessages(params: InboxListParams = {}): Promise<PaginatedResult<InboxMessageDto>> {
  await requireSession();

  const status = params.status ?? "PENDING";
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? INBOX_PAGE_SIZE;

  const where: Prisma.InboxMessageWhereInput = {
    status,
    ...(params.q
      ? {
          OR: [
            { description: { contains: params.q, mode: "insensitive" } },
            { subject: { contains: params.q, mode: "insensitive" } },
            { sender: { contains: params.q, mode: "insensitive" } },
            { body: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, messages] = await Promise.all([
    prisma.inboxMessage.count({ where }),
    prisma.inboxMessage.findMany({ where, orderBy: { receivedAt: "desc" }, ...paginate(page, pageSize) }),
  ]);

  return {
    items: messages.map((m) => {
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
        suggestedCategory: guessCategory(type, description),
        transactionId: m.transactionId,
      };
    }),
    total,
    page,
    pageSize,
    pageCount: pageCountFor(total, pageSize),
  };
}

export async function countPendingInbox(): Promise<number> {
  await requireSession();
  return prisma.inboxMessage.count({ where: { status: "PENDING" } });
}
