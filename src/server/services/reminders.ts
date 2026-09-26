import { Prisma } from "@/generated/prisma/client";
import { reminderDueOn, resendableAs, sumMoney, toDbString, toDecimal, toNumber } from "@/lib/calculations";
import { addDaysIso, fromIsoDate, type IsoDate, todayIso, toIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { renderReminderBody, renderReminderSubject } from "@/lib/reminders/render";
import { REMINDER_BATCH_SIZE } from "@/lib/validations/reminder";

import { NotFoundError, ServiceError } from "../errors";
import { isMailerConfigured, MAILER_NOT_CONFIGURED, sendMail } from "../mailer";
import { getReminderSettings, type ReminderSettings } from "./settings";

/** Everything the text needs, fetched once per installment. */
const installmentForEmail = {
  loan: {
    select: {
      status: true,
      person: { select: { name: true, email: true } },
      installments: { select: { totalAmount: true, paidAmount: true } },
    },
  },
} satisfies Prisma.InstallmentInclude;

type InstallmentForEmail = Prisma.InstallmentGetPayload<{ include: typeof installmentForEmail }>;

/** Everything still owed across the loan, which is what the borrower wants to know. */
function loanBalanceOf(installment: InstallmentForEmail) {
  return sumMoney(
    installment.loan.installments.map((i) => toDecimal(i.totalAmount).minus(toDecimal(i.paidAmount))),
  );
}

/** A reminder waiting to go out, with everything the text needs already loaded. */
const pendingReminderInclude = {
  installment: { include: installmentForEmail },
} satisfies Prisma.PaymentReminderInclude;

type PendingReminder = Prisma.PaymentReminderGetPayload<{ include: typeof pendingReminderInclude }>;

export type ReminderRunResult = { generated: number; sent: number; failed: number; skipped: number };

/**
 * Creates the reminders today asks for, once each. The unique key
 * (installment, kind, day) makes a second call a no-op, so the endpoint can be
 * called again without fear. Someone with no email still gets a row, as SKIPPED,
 * so the screen can show who has to be chased another way.
 */
export async function generateDueReminders(today: IsoDate = todayIso()): Promise<{ created: number; skipped: number }> {
  const settings = await getReminderSettings();
  if (!settings.enabled) return { created: 0, skipped: 0 };

  const installments = await prisma.installment.findMany({
    where: {
      status: { not: "PAID" },
      loan: { status: { not: "CANCELLED" } },
      // Only what can possibly qualify today: due tomorrow at the latest.
      dueDate: { lte: fromIsoDate(addDaysIso(today, 1)) },
    },
    include: installmentForEmail,
  });

  let created = 0;
  let skipped = 0;

  for (const installment of installments) {
    const due = reminderDueOn(
      {
        dueDate: toIsoDate(installment.dueDate),
        totalAmount: installment.totalAmount,
        paidAmount: installment.paidAmount,
        loanStatus: installment.loan.status,
      },
      today,
    );
    if (!due) continue;

    const email = installment.loan.person.email;
    const amount = toDecimal(installment.totalAmount).minus(toDecimal(installment.paidAmount));
    const subject = renderReminderSubject({
      personName: installment.loan.person.name,
      installmentNumber: installment.installmentNumber,
      dueDate: toIsoDate(installment.dueDate),
      amount: toNumber(amount),
      loanBalance: toNumber(loanBalanceOf(installment)),
      kind: due.kind,
      daysOverdue: due.daysOverdue,
      signature: settings.signature,
      contact: settings.contact,
    });

    const result = await prisma.paymentReminder.createMany({
      data: [
        {
          installmentId: installment.id,
          kind: due.kind,
          scheduledFor: fromIsoDate(today),
          status: email ? "PENDING" : "SKIPPED",
          skipReason: email ? null : "NO_EMAIL",
          recipientEmail: email,
          amount: toDbString(amount),
          subject,
          daysOverdue: due.daysOverdue,
        },
      ],
      // The unique key already guarantees one per day; this keeps repeat runs silent.
      skipDuplicates: true,
    });
    if (result.count === 0) continue;
    if (email) created += 1;
    else skipped += 1;
  }

  return { created, skipped };
}

/** "taken" means another run claimed the row first, so this one does nothing. */
type DeliveryOutcome = "sent" | "failed" | "skipped" | "taken";

/**
 * Handles one reminder from end to end and never throws: whatever goes wrong
 * with this row — the database, the text, the mail server — the rest of the
 * batch still goes out.
 */
async function deliverReminder(reminder: PendingReminder, settings: ReminderSettings): Promise<DeliveryOutcome> {
  const recipient = reminder.recipientEmail;
  // The query already filters these out; the guard keeps that invariant here,
  // where the address is used, instead of in a `where` clause far away. It
  // closes the row too, so a stray PENDING without an address cannot come back
  // every run forever.
  if (!recipient) {
    await prisma.paymentReminder
      .update({ where: { id: reminder.id }, data: { status: "SKIPPED", skipReason: "NO_EMAIL" } })
      .catch(() => undefined);
    return "skipped";
  }

  // Once the email is out there is no taking it back, so a failure after this
  // point must never be recorded as FAILED: a retry would send a second copy.
  let delivered = false;

  try {
    const { installment } = reminder;
    const stillOwed = toDecimal(installment.totalAmount).minus(toDecimal(installment.paidAmount));
    const cancelled = installment.loan.status === "CANCELLED";
    if (stillOwed.lte(0) || cancelled) {
      await prisma.paymentReminder.update({
        where: { id: reminder.id },
        data: { status: "SKIPPED", skipReason: cancelled ? "LOAN_CANCELLED" : "ALREADY_PAID" },
      });
      return "skipped";
    }

    const text = renderReminderBody({
      personName: installment.loan.person.name,
      installmentNumber: installment.installmentNumber,
      dueDate: toIsoDate(installment.dueDate),
      amount: toNumber(stillOwed),
      loanBalance: toNumber(loanBalanceOf(installment)),
      kind: reminder.kind,
      daysOverdue: reminder.daysOverdue,
      signature: settings.signature,
      contact: settings.contact,
    });

    // Claim the row before sending. The write is atomic, so of two runs reading
    // the same batch — the cron and the button pressed seconds later — only one
    // gets the count and only one borrower email goes out.
    const claim = await prisma.paymentReminder.updateMany({
      where: { id: reminder.id, status: "PENDING", sentAt: null },
      data: { sentAt: new Date() },
    });
    if (claim.count === 0) return "taken";

    await sendMail({ to: recipient, subject: reminder.subject, text });
    delivered = true;

    await prisma.paymentReminder.update({
      where: { id: reminder.id },
      data: { status: "SENT", error: null },
    });
    return "sent";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al enviar";
    const data = delivered
      ? {
          status: "SENT" as const,
          error: `Enviado, pero no se pudo registrar: ${message}`.slice(0, 500),
        }
      // The claim is released along with the failure, so a retry can take it again.
      : { status: "FAILED" as const, sentAt: null, error: message.slice(0, 500) };

    try {
      await prisma.paymentReminder.update({ where: { id: reminder.id }, data });
    } catch {
      // The database is out of reach. The counters returned by the run still say
      // what happened, but the row stays PENDING, so if the email had already
      // gone out the next run would send a second copy. Only claiming the row
      // before sending closes that window, at a write per email; with one
      // borrower list and a daily run the trade is worth naming, not paying.
    }
    return delivered ? "sent" : "failed";
  }
}

/**
 * Sends what is waiting, one email at a time so a single failure cannot take the
 * batch down with it. An installment paid between generation and delivery is
 * skipped instead of chasing someone who already paid.
 */
export async function sendPendingReminders(): Promise<{ sent: number; failed: number; skipped: number }> {
  const settings = await getReminderSettings();
  if (!settings.enabled) return { sent: 0, failed: 0, skipped: 0 };

  // Without credentials every single send would fail for the same reason, and
  // the whole queue would end up FAILED waiting for someone to retry it row by
  // row. Better to stop before touching anything and leave it all PENDING.
  if (!isMailerConfigured() && process.env.NODE_ENV === "production") {
    throw new ServiceError(MAILER_NOT_CONFIGURED);
  }

  // A reminder says "vence mañana" or "hace 8 días": true on the day it was
  // written and false a week later. Anything older than yesterday is retired
  // unsent rather than delivered as a lie — yesterday still counts because a run
  // can start before midnight and finish after it.
  const today = todayIso();
  const stale = await prisma.paymentReminder.updateMany({
    where: { status: "PENDING", scheduledFor: { lt: fromIsoDate(addDaysIso(today, -1)) } },
    data: { status: "SKIPPED", skipReason: "STALE" },
  });

  const pending = await prisma.paymentReminder.findMany({
    where: { status: "PENDING", recipientEmail: { not: null } },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: REMINDER_BATCH_SIZE,
    include: pendingReminderInclude,
  });

  let sent = 0;
  let failed = 0;
  let skipped = stale.count;

  for (const reminder of pending) {
    const outcome = await deliverReminder(reminder, settings);
    if (outcome === "sent") sent += 1;
    else if (outcome === "failed") failed += 1;
    else if (outcome === "skipped") skipped += 1;
  }

  return { sent, failed, skipped };
}

/** The daily run: work out what is due, then send it. */
export async function runReminders(): Promise<ReminderRunResult> {
  const generated = await generateDueReminders();
  const delivery = await sendPendingReminders();
  return {
    generated: generated.created,
    sent: delivery.sent,
    failed: delivery.failed,
    skipped: generated.skipped + delivery.skipped,
  };
}

/**
 * Puts a failed reminder back in the queue, dated today: a reminder written days
 * ago would otherwise go out saying "vence mañana" about a date already past, and
 * the send only takes what is current. The days late and the subject are worked
 * out again for the same reason.
 */
export async function retryReminder(id: string): Promise<void> {
  const reminder = await prisma.paymentReminder.findUnique({
    where: { id },
    include: { installment: { include: installmentForEmail } },
  });
  if (!reminder) throw new NotFoundError("El recordatorio");
  if (reminder.status !== "FAILED") throw new ServiceError("Solo se pueden reintentar los recordatorios que fallaron");
  if (!reminder.recipientEmail) throw new ServiceError("La persona no tiene correo registrado");

  const { installment } = reminder;
  const today = todayIso();
  const dueDate = toIsoDate(installment.dueDate);
  const daysLate = resendableAs(reminder.kind, today, dueDate);

  if (daysLate === false) {
    throw new ServiceError(
      reminder.kind === "BEFORE_DUE"
        ? "Ese aviso era para la víspera del vencimiento y ya pasó. La cuota vencida se avisa sola en la próxima corrida."
        : "Esa cuota todavía no está vencida, así que ese aviso ya no aplica",
    );
  }

  const settings = await getReminderSettings();
  const amount = toDecimal(installment.totalAmount).minus(toDecimal(installment.paidAmount));
  const subject = renderReminderSubject({
    personName: installment.loan.person.name,
    installmentNumber: installment.installmentNumber,
    dueDate,
    amount: toNumber(amount),
    loanBalance: toNumber(loanBalanceOf(installment)),
    kind: reminder.kind,
    daysOverdue: daysLate,
    signature: settings.signature,
    contact: settings.contact,
  });

  try {
    await prisma.paymentReminder.update({
      where: { id },
      data: {
        status: "PENDING",
        error: null,
        sentAt: null,
        scheduledFor: fromIsoDate(today),
        daysOverdue: daysLate,
        subject,
        amount: toDbString(amount),
      },
    });
  } catch (error) {
    // Moving it to today can collide with the reminder today's run already made
    // for the same cuota, which is the one that should go out anyway.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("Ya hay un recordatorio de hoy para esa cuota; ese es el que se enviará");
    }
    throw error;
  }
}
