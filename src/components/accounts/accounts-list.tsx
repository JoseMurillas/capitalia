"use client";

import { ArrowLeftRight, MoreHorizontal, Pencil, Plus, Power, Scale, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { MoneyDisplay } from "@/components/shared/money-display";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACCOUNT_KIND_LABELS } from "@/lib/labels";
import { deleteAccountAction, setAccountActiveAction } from "@/server/actions/accounts";
import type { AccountDto, AccountOption, AccountsSummary } from "@/server/queries/accounts";

import { AccountAdjustDialog } from "./account-adjust-dialog";
import { AccountCard } from "./account-card";
import { AccountFormDialog } from "./account-form-dialog";
import { AccountTransferDialog } from "./account-transfer-dialog";
import { UnassignedNotice } from "./unassigned-notice";

/** Where the money is most of the time comes first; cash closes the list. */
const KIND_ORDER = ["DEBIT", "SAVINGS", "WALLET", "CASH"] as const satisfies readonly AccountDto["kind"][];

type AccountsListProps = {
  accounts: AccountDto[];
  summary: AccountsSummary;
};

export function AccountsList({ accounts, summary }: AccountsListProps) {
  const [form, setForm] = useState<{ open: boolean; account: AccountDto | null }>({ open: false, account: null });
  const [transferring, setTransferring] = useState<AccountDto | null>(null);
  const [adjusting, setAdjusting] = useState<AccountDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccountDto | null>(null);

  // Subtotals come from the server, already added up as Decimals.
  const kindTotals = new Map(summary.byKind.map((row) => [row.kind, row]));
  const activeCount = accounts.filter((account) => account.active).length;
  // Only an active account can receive a transfer, and never the one you are moving from.
  const transferTargets: AccountOption[] = accounts
    .filter((account) => account.active && account.id !== transferring?.id)
    .map(({ id, name, kind }) => ({ id, name, kind }));

  const toggleActive = async (account: AccountDto) => {
    const response = await setAccountActiveAction(account.id, !account.active);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    toast.success(account.active ? "Cuenta desactivada" : "Cuenta activada");
  };

  const remove = async () => {
    if (!pendingDelete) return;
    const response = await deleteAccountAction(pendingDelete.id);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    toast.success("Cuenta eliminada");
  };

  const renderActions = (account: AccountDto) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${account.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setForm({ open: true, account })}>
          <Pencil aria-hidden="true" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!account.active} onSelect={() => setTransferring(account)}>
          <ArrowLeftRight aria-hidden="true" />
          Transferir
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!account.active} onSelect={() => setAdjusting(account)}>
          <Scale aria-hidden="true" />
          Ajustar saldo
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toggleActive(account)}>
          <Power aria-hidden="true" />
          {account.active ? "Desactivar" : "Activar"}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(account)}>
          <Trash2 aria-hidden="true" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <StatCard
          title="Total en tus cuentas"
          value={<MoneyDisplay value={summary.total} tone={summary.total < 0 ? "negative" : "neutral"} />}
          icon={Wallet}
          tone="info"
          hint={`${activeCount} ${activeCount === 1 ? "cuenta activa" : "cuentas activas"}`}
        />
        <UnassignedNotice count={summary.unassignedCount} />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setForm({ open: true, account: null })}>
          <Plus aria-hidden="true" />
          Nueva cuenta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Aún no hay cuentas"
          description="Crea una cuenta para saber cuánto tienes en cada sitio: la débito, los ahorros, el efectivo o la billetera."
          action={
            <Button size="sm" onClick={() => setForm({ open: true, account: null })}>
              Crear la primera cuenta
            </Button>
          }
        />
      ) : (
        KIND_ORDER.map((kind) => {
          // Already sorted by the query: active first, then by name.
          const group = accounts.filter((account) => account.kind === kind);
          if (group.length === 0) return null;
          const subtotal = kindTotals.get(kind);

          return (
            <section key={kind} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2 border-b pb-1">
                <h2 className="text-sm font-medium text-muted-foreground">{ACCOUNT_KIND_LABELS[kind]}</h2>
                {subtotal ? (
                  <MoneyDisplay
                    value={subtotal.total}
                    tone={subtotal.total < 0 ? "negative" : "neutral"}
                    className="text-sm font-semibold"
                  />
                ) : null}
              </div>
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                {group.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    href={`/finanzas/cuentas/${account.id}`}
                    actions={renderActions(account)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      <AccountFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        account={form.account}
      />
      <AccountTransferDialog
        open={Boolean(transferring)}
        onOpenChange={(open) => !open && setTransferring(null)}
        account={transferring}
        otherAccounts={transferTargets}
      />
      <AccountAdjustDialog
        open={Boolean(adjusting)}
        onOpenChange={(open) => !open && setAdjusting(null)}
        account={adjusting}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="¿Eliminar cuenta?"
        description={
          pendingDelete
            ? `Se eliminará «${pendingDelete.name}». Solo es posible si no tiene movimientos; si los tiene, desactívala para conservar su historia.`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
