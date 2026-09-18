"use client";

import { MoreHorizontal, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileCard } from "@/components/shared/mobile-card";
import { MoneyDisplay } from "@/components/shared/money-display";
import { TablePagination } from "@/components/shared/pagination";
import { TransactionTypeBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate } from "@/lib/dates";
import { TRANSACTION_CATEGORY_LABELS } from "@/lib/labels";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/validations/transaction";
import { deleteTransactionAction } from "@/server/actions/transactions";
import type { TransactionDto, TransactionListTotals } from "@/server/queries/transactions";
import type { PaginatedResult } from "@/types";

import { TransactionFormDialog } from "./transaction-form-dialog";

type TransactionsListProps = {
  result: PaginatedResult<TransactionDto> & { totals: TransactionListTotals };
  type?: "INCOME" | "EXPENSE";
  category?: string;
  hasFilters: boolean;
};

const ALL = "all";

export function TransactionsList({ result, type, category, hasFilters }: TransactionsListProps) {
  const { setParams } = useUrlParams();
  const [dialog, setDialog] = useState<{ open: boolean; type: "INCOME" | "EXPENSE"; transaction: TransactionDto | null }>({
    open: false,
    type: "EXPENSE",
    transaction: null,
  });
  const [pendingDelete, setPendingDelete] = useState<TransactionDto | null>(null);

  const openCreate = (kind: "INCOME" | "EXPENSE") => setDialog({ open: true, type: kind, transaction: null });
  const openEdit = (transaction: TransactionDto) => setDialog({ open: true, type: transaction.type, transaction });

  const remove = async () => {
    if (!pendingDelete) return;
    const response = await deleteTransactionAction(pendingDelete.id);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    toast.success("Movimiento eliminado");
  };

  const columns: DataTableColumn<TransactionDto>[] = [
    {
      key: "date",
      header: "Fecha",
      cell: (t) => <span className="whitespace-nowrap">{formatDate(t.transactionDate)}</span>,
    },
    { key: "type", header: "Tipo", cell: (t) => <TransactionTypeBadge type={t.type} /> },
    {
      key: "category",
      header: "Categoría",
      className: "hidden sm:table-cell",
      cell: (t) => TRANSACTION_CATEGORY_LABELS[t.category],
    },
    {
      key: "description",
      header: "Descripción",
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.description}</p>
          {t.notes ? <p className="truncate text-xs text-muted-foreground">{t.notes}</p> : null}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Monto",
      className: "text-right",
      cell: (t) => (
        <MoneyDisplay
          value={t.type === "INCOME" ? t.amount : -t.amount}
          tone={t.type === "INCOME" ? "positive" : "negative"}
          signed
          className="font-medium"
        />
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-12 text-right",
      cell: (t) => renderActions(t),
    },
  ];

  function renderActions(t: TransactionDto) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${t.description}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => openEdit(t)}>
            <Pencil aria-hidden="true" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(t)}>
            <Trash2 aria-hidden="true" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <DateRangePicker />
        <Select
          value={type ?? ALL}
          onValueChange={(value) => setParams({ type: value === ALL ? null : value, category: null }, { resetPage: true })}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="INCOME">Ingresos</SelectItem>
            <SelectItem value="EXPENSE">Gastos</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={category ?? ALL}
          onValueChange={(value) => setParams({ category: value === ALL ? null : value }, { resetPage: true })}
        >
          <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por categoría">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las categorías</SelectItem>
            {type !== "EXPENSE" ? (
              <SelectGroup>
                <SelectLabel>Ingresos</SelectLabel>
                {INCOME_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {TRANSACTION_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
            {type !== "INCOME" ? (
              <SelectGroup>
                <SelectLabel>Gastos</SelectLabel>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {TRANSACTION_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
          </SelectContent>
        </Select>
        <div className="flex gap-2 lg:ml-auto">
          <Button variant="outline" onClick={() => openCreate("INCOME")}>
            <Plus aria-hidden="true" />
            Ingreso
          </Button>
          <Button onClick={() => openCreate("EXPENSE")}>
            <Plus aria-hidden="true" />
            Gasto
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={result.items}
        getRowId={(t) => t.id}
        renderCard={(t) => (
          <MobileCard
            title={t.description}
            subtitle={`${formatDate(t.transactionDate)} · ${TRANSACTION_CATEGORY_LABELS[t.category]}`}
            value={
              <MoneyDisplay
                value={t.type === "INCOME" ? t.amount : -t.amount}
                tone={t.type === "INCOME" ? "positive" : "negative"}
                signed
              />
            }
            badge={<TransactionTypeBadge type={t.type} />}
            meta={t.notes ? [{ label: "Notas", value: t.notes }] : undefined}
            actions={renderActions(t)}
          />
        )}
        emptyState={
          <EmptyState
            icon={Wallet}
            title={hasFilters ? "Sin movimientos en este filtro" : "Aún no hay movimientos"}
            description={
              hasFilters ? "Ajusta las fechas o la categoría." : "Registra tus ingresos y gastos para conocer tu flujo de caja."
            }
            action={
              hasFilters ? null : (
                <Button size="sm" onClick={() => openCreate("INCOME")}>
                  Registrar un ingreso
                </Button>
              )
            }
          />
        }
      />

      <TablePagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={result.pageSize}
        itemLabel="movimientos"
      />

      <TransactionFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        transaction={dialog.transaction}
        defaultType={dialog.type}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="¿Eliminar movimiento?"
        description={pendingDelete ? `Se eliminará «${pendingDelete.description}». Esta acción no se puede deshacer.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
