"use client";

import { CheckCircle2, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileCard } from "@/components/shared/mobile-card";
import { MoneyDisplay } from "@/components/shared/money-display";
import { ActiveBadge, CommitmentStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate } from "@/lib/dates";
import {
  dueInLabel,
  RECURRING_FREQUENCY_LABELS,
  RECURRING_PAYMENT_METHOD_LABELS,
  TRANSACTION_CATEGORY_LABELS,
} from "@/lib/labels";
import type { RecurringStatusFilter } from "@/lib/validations/recurring";
import { EXPENSE_CATEGORIES } from "@/lib/validations/transaction";
import { deleteRecurringExpenseAction, setRecurringActiveAction } from "@/server/actions/recurring";
import type { CreditCardOption } from "@/server/queries/credit-cards";
import type { RecurringExpenseDto } from "@/server/queries/recurring";

import { MarkPaidDialog } from "./mark-paid-dialog";
import { RecurringFormDialog } from "./recurring-form-dialog";

type RecurringListProps = {
  expenses: RecurringExpenseDto[];
  cards: CreditCardOption[];
  defaultReminderDays: number;
  status: RecurringStatusFilter;
  category?: string;
};

const ALL = "all";

function frequencyLabel(e: RecurringExpenseDto): string {
  if (e.frequency === "CUSTOM" && e.customIntervalDays) return `Cada ${e.customIntervalDays} días`;
  return RECURRING_FREQUENCY_LABELS[e.frequency];
}

function methodLabel(e: RecurringExpenseDto): string {
  if (e.paymentMethod === "CREDIT_CARD") return e.creditCardName ? `TC · ${e.creditCardName}` : "Tarjeta de crédito";
  return RECURRING_PAYMENT_METHOD_LABELS[e.paymentMethod];
}

export function RecurringList({ expenses, cards, defaultReminderDays, status, category }: RecurringListProps) {
  const { setParams } = useUrlParams();
  const [form, setForm] = useState<{ open: boolean; expense: RecurringExpenseDto | null }>({ open: false, expense: null });
  const [paying, setPaying] = useState<RecurringExpenseDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecurringExpenseDto | null>(null);

  const toggleActive = async (expense: RecurringExpenseDto) => {
    const response = await setRecurringActiveAction(expense.id, !expense.active);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    toast.success(expense.active ? "Gasto pausado" : "Gasto activado");
  };

  const remove = async () => {
    if (!pendingDelete) return;
    const response = await deleteRecurringExpenseAction(pendingDelete.id);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    toast.success("Gasto recurrente eliminado");
  };

  const renderActions = (e: RecurringExpenseDto) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${e.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!e.active} onSelect={() => setPaying(e)}>
          <CheckCircle2 aria-hidden="true" />
          Marcar pagado
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setForm({ open: true, expense: e })}>
          <Pencil aria-hidden="true" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toggleActive(e)}>
          {e.active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {e.active ? "Pausar" : "Activar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(e)}>
          <Trash2 aria-hidden="true" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: DataTableColumn<RecurringExpenseDto>[] = [
    {
      key: "name",
      header: "Gasto",
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{e.name}</p>
          {e.notes ? <p className="truncate text-xs text-muted-foreground">{e.notes}</p> : null}
        </div>
      ),
    },
    { key: "category", header: "Categoría", className: "hidden lg:table-cell", cell: (e) => TRANSACTION_CATEGORY_LABELS[e.category] },
    { key: "frequency", header: "Frecuencia", className: "hidden sm:table-cell", cell: frequencyLabel },
    {
      key: "next",
      header: "Próximo pago",
      cell: (e) => (
        <div className="flex flex-col gap-1">
          <span className="whitespace-nowrap">{formatDate(e.nextDueDate)}</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {e.active ? (
              <>
                <CommitmentStatusBadge status={e.status} />
                {dueInLabel(e.daysUntilDue)}
              </>
            ) : (
              <ActiveBadge active={false} />
            )}
          </span>
        </div>
      ),
    },
    { key: "method", header: "Método", className: "hidden md:table-cell", cell: methodLabel },
    {
      key: "amount",
      header: "Valor",
      className: "text-right",
      cell: (e) => (
        <div className="flex flex-col items-end">
          <MoneyDisplay value={e.amount} className="font-medium" />
          {e.isVariable ? <span className="text-xs text-muted-foreground">variable</span> : null}
          {e.frequency !== "MONTHLY" ? (
            <span className="text-xs text-muted-foreground">
              ≈ <MoneyDisplay value={e.monthlyEquivalent} /> / mes
            </span>
          ) : null}
        </div>
      ),
    },
    { key: "actions", header: <span className="sr-only">Acciones</span>, className: "w-12 text-right", cell: renderActions },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <Select value={status} onValueChange={(value) => setParams({ status: value === "active" ? null : value })}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category ?? ALL} onValueChange={(value) => setParams({ category: value === ALL ? null : value })}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por categoría">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las categorías</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {TRANSACTION_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 lg:ml-auto">
          <Button onClick={() => setForm({ open: true, expense: null })}>
            <Plus aria-hidden="true" />
            Nuevo gasto recurrente
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={expenses}
        getRowId={(e) => e.id}
        rowClassName={(e) => (e.active ? undefined : "opacity-60")}
        renderCard={(e) => (
          <MobileCard
            title={e.name}
            subtitle={`${formatDate(e.nextDueDate)} · ${dueInLabel(e.daysUntilDue)}`}
            value={<MoneyDisplay value={e.amount} />}
            badge={e.active ? <CommitmentStatusBadge status={e.status} /> : <ActiveBadge active={false} />}
            meta={[
              { label: "Categoría", value: TRANSACTION_CATEGORY_LABELS[e.category] },
              { label: "Frecuencia", value: frequencyLabel(e) },
              { label: "Método", value: methodLabel(e) },
              { label: "Al mes", value: <MoneyDisplay value={e.monthlyEquivalent} /> },
            ]}
            actions={renderActions(e)}
          />
        )}
        emptyState={
          <EmptyState
            icon={Repeat}
            title={status === "active" && !category ? "Aún no hay gastos recurrentes" : "Nada con este filtro"}
            description={
              status === "active" && !category
                ? "Registra arriendo, servicios, suscripciones o cuotas para recibir avisos antes de cada pago."
                : "Cambia el estado o la categoría."
            }
            action={
              status === "active" && !category ? (
                <Button size="sm" onClick={() => setForm({ open: true, expense: null })}>
                  Registrar un gasto recurrente
                </Button>
              ) : null
            }
          />
        }
      />

      <RecurringFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        expense={form.expense}
        cards={cards}
        defaultReminderDays={defaultReminderDays}
      />
      <MarkPaidDialog open={Boolean(paying)} onOpenChange={(open) => !open && setPaying(null)} target={paying} />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="¿Eliminar gasto recurrente?"
        description={pendingDelete ? `Se eliminará «${pendingDelete.name}». Los gastos ya registrados en Finanzas se conservan.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
