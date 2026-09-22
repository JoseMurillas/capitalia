"use client";

import { FileText, History, MoreHorizontal, Pencil, Plus, Receipt, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileCard } from "@/components/shared/mobile-card";
import { MoneyDisplay } from "@/components/shared/money-display";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/dates";
import { CARD_MOVEMENT_KIND_LABELS } from "@/lib/labels";
import { deleteInstallmentPlanAction } from "@/server/actions/credit-cards";
import type { CardMovementDto, CreditCardDetailDto, InstallmentPlanDto } from "@/server/queries/credit-cards";

import { CardPaymentDialog } from "./card-payment-dialog";
import { CardStatementDialog } from "./card-statement-dialog";
import { CreditCardCard } from "./credit-card-card";
import { CreditCardFormDialog } from "./credit-card-form-dialog";
import { InstallmentPlanDialog } from "./installment-plan-dialog";

type CreditCardDetailProps = {
  card: CreditCardDetailDto;
  defaultReminderDays: number;
};

const movementTone = { CHARGE: "warning", PAYMENT: "success", ADJUSTMENT: "neutral" } as const;

export function CreditCardDetail({ card, defaultReminderDays }: CreditCardDetailProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [planDialog, setPlanDialog] = useState<{ open: boolean; plan: InstallmentPlanDto | null }>({ open: false, plan: null });
  const [pendingDelete, setPendingDelete] = useState<InstallmentPlanDto | null>(null);

  const removePlan = async () => {
    if (!pendingDelete) return;
    const response = await deleteInstallmentPlanAction(card.id, pendingDelete.id);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    toast.success("Compra eliminada");
  };

  const planActions = (plan: InstallmentPlanDto) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${plan.description}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setPlanDialog({ open: true, plan })}>
          <Pencil aria-hidden="true" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(plan)}>
          <Trash2 aria-hidden="true" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const planColumns: DataTableColumn<InstallmentPlanDto>[] = [
    { key: "description", header: "Compra", cell: (p) => <span className="font-medium">{p.description}</span> },
    { key: "date", header: "Fecha", className: "hidden sm:table-cell", cell: (p) => formatDate(p.startDate) },
    { key: "total", header: "Total", className: "text-right", cell: (p) => <MoneyDisplay value={p.totalAmount} /> },
    { key: "installment", header: "Cuota", className: "text-right", cell: (p) => <MoneyDisplay value={p.installmentAmount} /> },
    {
      key: "progress",
      header: "Cuotas",
      className: "text-right",
      cell: (p) => (
        <span className="tabular-nums">
          {p.paidInstallments}/{p.installments}
          {p.finished ? <StatusBadge tone="success" className="ml-2">Terminada</StatusBadge> : null}
        </span>
      ),
    },
    { key: "remaining", header: "Saldo restante", className: "text-right", cell: (p) => <MoneyDisplay value={p.remainingAmount} className="font-medium" /> },
    { key: "actions", header: <span className="sr-only">Acciones</span>, className: "w-12 text-right", cell: planActions },
  ];

  const movementColumns: DataTableColumn<CardMovementDto>[] = [
    { key: "date", header: "Fecha", cell: (m) => <span className="whitespace-nowrap">{formatDate(m.movementDate)}</span> },
    { key: "kind", header: "Tipo", cell: (m) => <StatusBadge tone={movementTone[m.kind]}>{CARD_MOVEMENT_KIND_LABELS[m.kind]}</StatusBadge> },
    {
      key: "description",
      header: "Descripción",
      cell: (m) =>
        m.transactionId ? (
          <Link href={`/finanzas/movimientos?from=${m.movementDate}&to=${m.movementDate}`} className="hover:underline">
            {m.description}
          </Link>
        ) : (
          m.description
        ),
    },
    {
      key: "amount",
      header: "Monto",
      className: "text-right",
      cell: (m) => (
        <MoneyDisplay
          value={m.kind === "PAYMENT" ? -m.amount : m.amount}
          tone={m.kind === "PAYMENT" ? "positive" : m.amount < 0 ? "positive" : "negative"}
          signed
          className="font-medium"
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <CreditCardCard
        card={card}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!card.active} onClick={() => setPaymentOpen(true)}>
              <Receipt aria-hidden="true" />
              Registrar pago
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatementOpen(true)}>
              <FileText aria-hidden="true" />
              Extracto
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden="true" />
              Editar
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Compras diferidas</CardTitle>
          <CardDescription>Compras a cuotas que explican el pago de cada mes.</CardDescription>
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setPlanDialog({ open: true, plan: null })}>
              <Plus aria-hidden="true" />
              Agregar
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={planColumns}
            rows={card.plans}
            getRowId={(p) => p.id}
            renderCard={(p) => (
              <MobileCard
                title={p.description}
                subtitle={`${formatDate(p.startDate)} · ${p.paidInstallments}/${p.installments} cuotas`}
                value={<MoneyDisplay value={p.installmentAmount} />}
                badge={p.finished ? <StatusBadge tone="success">Terminada</StatusBadge> : null}
                meta={[
                  { label: "Total", value: <MoneyDisplay value={p.totalAmount} /> },
                  { label: "Saldo restante", value: <MoneyDisplay value={p.remainingAmount} /> },
                ]}
                actions={planActions(p)}
              />
            )}
            emptyState={
              <EmptyState
                icon={ShoppingBag}
                title="Sin compras diferidas"
                description="Registra las compras a cuotas para saber cuánto de tu pago mensual viene de cada una."
                className="py-6"
              />
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
          <CardDescription>Cargos, pagos y ajustes de saldo (últimos 50).</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={movementColumns}
            rows={card.movements}
            getRowId={(m) => m.id}
            renderCard={(m) => (
              <MobileCard
                title={m.description}
                subtitle={formatDate(m.movementDate)}
                value={
                  <MoneyDisplay
                    value={m.kind === "PAYMENT" ? -m.amount : m.amount}
                    tone={m.kind === "PAYMENT" ? "positive" : m.amount < 0 ? "positive" : "negative"}
                    signed
                  />
                }
                badge={<StatusBadge tone={movementTone[m.kind]}>{CARD_MOVEMENT_KIND_LABELS[m.kind]}</StatusBadge>}
              />
            )}
            emptyState={<EmptyState icon={History} title="Sin movimientos" description="Los pagos y cargos aparecerán aquí." className="py-6" />}
          />
        </CardContent>
      </Card>

      <CreditCardFormDialog open={editOpen} onOpenChange={setEditOpen} card={card} defaultReminderDays={defaultReminderDays} />
      <CardStatementDialog open={statementOpen} onOpenChange={setStatementOpen} card={card} />
      <CardPaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} card={card} />
      <InstallmentPlanDialog
        open={planDialog.open}
        onOpenChange={(open) => setPlanDialog((current) => ({ ...current, open }))}
        cardId={card.id}
        plan={planDialog.plan}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="¿Eliminar compra diferida?"
        description={pendingDelete ? `Se eliminará «${pendingDelete.description}». El saldo de la tarjeta no cambia.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={removePlan}
      />
    </div>
  );
}
