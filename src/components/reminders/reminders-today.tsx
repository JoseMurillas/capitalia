"use client";

import { MailCheck, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/dates";
import { reminderKindLabel } from "@/lib/labels";
import { retryReminderAction, runRemindersAction } from "@/server/actions/reminders";
import type { ReminderDto } from "@/server/queries/reminders";

import { ReminderStatusBadge, reminderSkipReason } from "./reminder-status-badge";

/** What each row is about, in one line. */
function reminderLine(reminder: ReminderDto): string {
  const kind = reminderKindLabel(reminder.kind, reminder.daysOverdue);
  return `Cuota ${reminder.installmentNumber} · vence ${formatDate(reminder.dueDate)} · ${kind}`;
}

export function RemindersToday({ reminders, enabled }: { reminders: ReminderDto[]; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  const retry = (reminder: ReminderDto) =>
    startTransition(async () => {
      const result = await retryReminderAction(reminder.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Volverá a intentarse en el próximo envío");
    });

  /** Fires today's run without waiting for the cron. */
  const runNow = () =>
    startTransition(async () => {
      const result = await runRemindersAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const { generated, sent, failed, skipped } = result.data;
      toast.success(`Enviados: ${sent} · fallidos: ${failed} · omitidos: ${skipped}`, {
        description: `Recordatorios generados en esta corrida: ${generated}`,
      });
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hoy</CardTitle>
        <CardDescription>Lo que toca enviar hoy y cómo le fue a cada uno.</CardDescription>
        <CardAction>
          {/* Paused, a run would report "enviados: 0" and look just like a quiet
              day, so the button says why it cannot do anything instead. */}
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || !enabled}
            onClick={runNow}
            title={enabled ? undefined : "Los recordatorios están pausados: actívalos en Configuración"}
          >
            {isPending ? <Spinner /> : <Send aria-hidden="true" />}
            Enviar ahora
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
          <EmptyState
            icon={MailCheck}
            title="Nada que recordar hoy"
            description="No hay cuotas que venzan mañana ni cuotas vencidas a las que toque insistir."
            className="border-0 py-6"
          />
        ) : (
          <ul className="divide-y">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <Link href={`/personas/${reminder.personId}`} className="font-medium hover:underline">
                    {reminder.personName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{reminderLine(reminder)}</p>
                  {reminder.status === "SKIPPED" ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">{reminderSkipReason(reminder)}</p>
                  ) : null}
                  {reminder.status === "FAILED" && reminder.error ? (
                    <p className="text-xs text-red-600 dark:text-red-400">{reminder.error}</p>
                  ) : null}
                  {reminder.recipientEmail ? (
                    <p className="truncate text-xs text-muted-foreground">{reminder.recipientEmail}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <MoneyDisplay value={reminder.amount} className="font-medium" />
                  <ReminderStatusBadge reminder={reminder} />
                  {reminder.status === "FAILED" ? (
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => retry(reminder)}>
                      <RefreshCw aria-hidden="true" />
                      Reintentar
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
