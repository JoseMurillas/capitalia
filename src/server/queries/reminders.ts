import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  PaymentReminderKind,
  PaymentReminderSkipReason,
  PaymentReminderStatus,
} from "@/generated/prisma/enums";
import { toNumber } from "@/lib/calculations";
import { fromIsoDate, type IsoDate, todayIso, toIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, pageCountFor, paginate } from "@/lib/search-params";
import { requireSession } from "@/server/auth";
import type { PaginatedResult } from "@/types";

export type ReminderDto = {
  id: string;
  personId: string;
  personName: string;
  loanId: string;
  installmentId: string;
  installmentNumber: number;
  dueDate: IsoDate;
  kind: PaymentReminderKind;
  status: PaymentReminderStatus;
  amount: number;
  /** Null means the person had no email when the reminder was generated. */
  recipientEmail: string | null;
  /** Why it was never sent; set only when the status is SKIPPED. */
  skipReason: PaymentReminderSkipReason | null;
  daysOverdue: number | null;
  scheduledFor: IsoDate;
  sentAt: string | null;
  subject: string;
  error: string | null;
};

export type ReminderListParams = {
  status?: PaymentReminderStatus;
  from?: IsoDate;
  to?: IsoDate;
  page?: number;
  pageSize?: number;
};

export type RemindersSummary = {
  sentToday: number;
  pendingToday: number;
  /** Skipped for want of an address: these are the people to chase by other means. */
  noEmailToday: number;
  /** Skipped for any other reason: already paid, loan cancelled, gone stale. */
  otherSkippedToday: number;
  failedToday: number;
};

const reminderInclude = {
  installment: {
    select: {
      id: true,
      installmentNumber: true,
      dueDate: true,
      loan: { select: { id: true, person: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.PaymentReminderInclude;

type ReminderRow = Prisma.PaymentReminderGetPayload<{ include: typeof reminderInclude }>;

function toDto(reminder: ReminderRow): ReminderDto {
  return {
    id: reminder.id,
    personId: reminder.installment.loan.person.id,
    personName: reminder.installment.loan.person.name,
    loanId: reminder.installment.loan.id,
    installmentId: reminder.installment.id,
    installmentNumber: reminder.installment.installmentNumber,
    dueDate: toIsoDate(reminder.installment.dueDate),
    kind: reminder.kind,
    status: reminder.status,
    amount: toNumber(reminder.amount),
    recipientEmail: reminder.recipientEmail,
    skipReason: reminder.skipReason,
    daysOverdue: reminder.daysOverdue,
    scheduledFor: toIsoDate(reminder.scheduledFor),
    sentAt: reminder.sentAt?.toISOString() ?? null,
    subject: reminder.subject,
    error: reminder.error,
  };
}

export async function listReminders(params: ReminderListParams = {}): Promise<PaginatedResult<ReminderDto>> {
  await requireSession();

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const where: Prisma.PaymentReminderWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.from || params.to
      ? {
          scheduledFor: {
            ...(params.from ? { gte: fromIsoDate(params.from) } : {}),
            ...(params.to ? { lte: fromIsoDate(params.to) } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.paymentReminder.count({ where }),
    prisma.paymentReminder.findMany({
      where,
      include: reminderInclude,
      orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
      ...paginate(page, pageSize),
    }),
  ]);

  return {
    items: rows.map(toDto),
    total,
    page,
    pageSize,
    pageCount: pageCountFor(total, pageSize),
  };
}

/** What today's run produced, whatever its state. */
export async function listTodayReminders(): Promise<ReminderDto[]> {
  await requireSession();
  const rows = await prisma.paymentReminder.findMany({
    where: { scheduledFor: fromIsoDate(todayIso()) },
    include: reminderInclude,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toDto);
}

export async function getRemindersSummary(): Promise<RemindersSummary> {
  await requireSession();
  const today = fromIsoDate(todayIso());
  // Skipping has several causes and only one of them asks something of the user,
  // so the count groups by the recorded reason rather than by status alone.
  const [byStatus, bySkipReason] = await Promise.all([
    prisma.paymentReminder.groupBy({
      by: ["status"],
      where: { scheduledFor: today },
      _count: { _all: true },
    }),
    prisma.paymentReminder.groupBy({
      by: ["skipReason"],
      where: { scheduledFor: today, status: "SKIPPED" },
      _count: { _all: true },
    }),
  ]);
  const countFor = (status: PaymentReminderStatus) =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;
  const noEmail = bySkipReason.find((row) => row.skipReason === "NO_EMAIL")?._count._all ?? 0;
  const skipped = bySkipReason.reduce((total, row) => total + row._count._all, 0);

  return {
    sentToday: countFor("SENT"),
    pendingToday: countFor("PENDING"),
    noEmailToday: noEmail,
    otherSkippedToday: skipped - noEmail,
    failedToday: countFor("FAILED"),
  };
}
