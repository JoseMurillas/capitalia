"use client";

import { Mail, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileCard } from "@/components/shared/mobile-card";
import { MoneyDisplay } from "@/components/shared/money-display";
import { TablePagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate } from "@/lib/dates";
import { reminderKindLabel, REMINDER_STATUS_LABELS } from "@/lib/labels";
import { REMINDER_STATUSES, type ReminderStatusValue } from "@/lib/validations/reminder";
import { retryReminderAction } from "@/server/actions/reminders";
import type { ReminderDto } from "@/server/queries/reminders";
import type { PaginatedResult } from "@/types";

import { ReminderStatusBadge } from "./reminder-status-badge";

const ALL = "all";

type RemindersHistoryProps = {
  result: PaginatedResult<ReminderDto>;
  status?: ReminderStatusValue;
};

export function RemindersHistory({ result, status }: RemindersHistoryProps) {
  const { setParams } = useUrlParams();
  const [isPending, startTransition] = useTransition();

  /**
   * A day of failures is not recoverable on its own: nothing regenerates a
   * reminder once it exists, so the only way back is from here, whatever day it
   * was scheduled for.
   */
  const retry = (reminder: ReminderDto) =>
    startTransition(async () => {
      const result = await retryReminderAction(reminder.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Volverá a intentarse en el próximo envío");
    });

  const retryButton = (r: ReminderDto) =>
    r.status === "FAILED" ? (
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => retry(r)}>
        <RefreshCw aria-hidden="true" />
        Reintentar
      </Button>
    ) : null;

  const columns: DataTableColumn<ReminderDto>[] = [
    {
      key: "date",
      header: "Fecha",
      cell: (r) => <span className="whitespace-nowrap">{formatDate(r.scheduledFor)}</span>,
    },
    {
      key: "person",
      header: "Persona",
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`/personas/${r.personId}`} className="truncate font-medium hover:underline">
            {r.personName}
          </Link>
          {r.recipientEmail ? <p className="truncate text-xs text-muted-foreground">{r.recipientEmail}</p> : null}
          {r.status === "FAILED" && r.error ? (
            <p className="text-xs text-red-600 dark:text-red-400">{r.error}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "installment",
      header: "Cuota",
      className: "hidden sm:table-cell",
      cell: (r) => (
        <Link href={`/prestamos/${r.loanId}`} className="hover:underline">
          #{r.installmentNumber} · {formatDate(r.dueDate)}
        </Link>
      ),
    },
    {
      key: "kind",
      header: "Tipo",
      className: "hidden lg:table-cell",
      cell: (r) => reminderKindLabel(r.kind, r.daysOverdue),
    },
    { key: "amount", header: "Valor", className: "text-right", cell: (r) => <MoneyDisplay value={r.amount} /> },
    { key: "status", header: "Estado", className: "text-right", cell: (r) => <ReminderStatusBadge reminder={r} /> },
    { key: "actions", header: "", className: "text-right", cell: retryButton },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={status ?? ALL}
          onValueChange={(value) => setParams({ status: value === ALL ? null : value }, { resetPage: true })}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {REMINDER_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {REMINDER_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangePicker />
      </div>

      <DataTable
        columns={columns}
        rows={result.items}
        getRowId={(r) => r.id}
        renderCard={(r) => (
          <MobileCard
            title={r.personName}
            subtitle={`${formatDate(r.scheduledFor)} · cuota ${r.installmentNumber}`}
            value={<MoneyDisplay value={r.amount} />}
            badge={<ReminderStatusBadge reminder={r} />}
            meta={[
              { label: "Correo", value: r.recipientEmail ?? "Sin correo" },
              { label: "Tipo", value: reminderKindLabel(r.kind, r.daysOverdue) },
            ]}
            actions={retryButton(r)}
          />
        )}
        emptyState={
          <EmptyState
            icon={Mail}
            title="Sin recordatorios"
            description="Aquí quedará el registro de cada correo enviado."
            className="py-6"
          />
        }
      />

      <TablePagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={result.pageSize}
        itemLabel="recordatorios"
      />
    </div>
  );
}
