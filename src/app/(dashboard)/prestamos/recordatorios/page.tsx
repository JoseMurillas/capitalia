import { AlertTriangle, MailCheck, MailX, Send } from "lucide-react";
import type { Metadata } from "next";

import { RemindersHistory } from "@/components/reminders/reminders-history";
import { RemindersToday } from "@/components/reminders/reminders-today";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getEnum, getIsoDate, getPage } from "@/lib/search-params";
import { REMINDER_STATUSES } from "@/lib/validations/reminder";
import { getRemindersSummary, listReminders, listTodayReminders } from "@/server/queries/reminders";
import { getReminderSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Recordatorios" };

export default async function RemindersPage({ searchParams }: PageProps<"/prestamos/recordatorios">) {
  const params = await searchParams;
  const status = getEnum(params, "status", REMINDER_STATUSES);
  const from = getIsoDate(params, "from");
  const to = getIsoDate(params, "to");
  const page = getPage(params);

  const [summary, today, history, settings] = await Promise.all([
    getRemindersSummary(),
    listTodayReminders(),
    listReminders({ status, from, to, page }),
    getReminderSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Recordatorios de pago"
        description={
          settings.enabled
            ? "Se avisa el día antes de que venza la cuota y, si no se paga, al día siguiente y cada semana."
            : "Están pausados: no se genera ni se envía nada. Actívalos en Configuración."
        }
        backHref="/prestamos"
        backLabel="Préstamos"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title="Enviados hoy" value={summary.sentToday} icon={MailCheck} tone="positive" />
        <StatCard
          title="Pendientes hoy"
          value={summary.pendingToday}
          icon={Send}
          tone={summary.pendingToday > 0 ? "warning" : "default"}
          hint="Esperando la próxima corrida diaria"
        />
        <StatCard
          title="Sin correo"
          value={summary.noEmailToday}
          icon={MailX}
          tone={summary.noEmailToday > 0 ? "warning" : "default"}
          hint={
            summary.otherSkippedToday > 0
              ? `Hay que buscarlos por otro canal. Otros ${summary.otherSkippedToday} se omitieron por otros motivos.`
              : "Hay que buscarlos por otro canal"
          }
        />
        <StatCard
          title="Fallidos hoy"
          value={summary.failedToday}
          icon={AlertTriangle}
          tone={summary.failedToday > 0 ? "negative" : "default"}
        />
      </div>

      <RemindersToday reminders={today} enabled={settings.enabled} />
      <RemindersHistory result={history} status={status} />
    </>
  );
}
