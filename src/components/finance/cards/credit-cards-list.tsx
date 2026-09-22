"use client";

import { CreditCard as CreditCardIcon, Eye, FileText, MoreHorizontal, Pencil, Plus, Power, Receipt, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteCreditCardAction, setCreditCardActiveAction } from "@/server/actions/credit-cards";
import type { CreditCardDto } from "@/server/queries/credit-cards";

import { CardPaymentDialog } from "./card-payment-dialog";
import { CardStatementDialog } from "./card-statement-dialog";
import { CreditCardCard } from "./credit-card-card";
import { CreditCardFormDialog } from "./credit-card-form-dialog";

type CreditCardsListProps = {
  cards: CreditCardDto[];
  defaultReminderDays: number;
};

export function CreditCardsList({ cards, defaultReminderDays }: CreditCardsListProps) {
  const [form, setForm] = useState<{ open: boolean; card: CreditCardDto | null }>({ open: false, card: null });
  const [statement, setStatement] = useState<CreditCardDto | null>(null);
  const [payment, setPayment] = useState<CreditCardDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CreditCardDto | null>(null);

  const toggleActive = async (card: CreditCardDto) => {
    const response = await setCreditCardActiveAction(card.id, !card.active);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    toast.success(card.active ? "Tarjeta desactivada" : "Tarjeta activada");
  };

  const remove = async () => {
    if (!pendingDelete) return;
    const response = await deleteCreditCardAction(pendingDelete.id);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    toast.success("Tarjeta eliminada");
  };

  const renderActions = (card: CreditCardDto) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${card.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!card.active} onSelect={() => setPayment(card)}>
          <Receipt aria-hidden="true" />
          Registrar pago
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setStatement(card)}>
          <FileText aria-hidden="true" />
          Actualizar extracto
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/finanzas/tarjetas/${card.id}`}>
            <Eye aria-hidden="true" />
            Ver detalle
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setForm({ open: true, card })}>
          <Pencil aria-hidden="true" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toggleActive(card)}>
          <Power aria-hidden="true" />
          {card.active ? "Desactivar" : "Activar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(card)}>
          <Trash2 aria-hidden="true" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ open: true, card: null })}>
          <Plus aria-hidden="true" />
          Nueva tarjeta
        </Button>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCardIcon}
          title="Aún no hay tarjetas"
          description="Registra tus tarjetas de crédito para ver cupo, utilización y próximos pagos."
          action={
            <Button size="sm" onClick={() => setForm({ open: true, card: null })}>
              Registrar una tarjeta
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {cards.map((card) => (
            <CreditCardCard key={card.id} card={card} href={`/finanzas/tarjetas/${card.id}`} actions={renderActions(card)} />
          ))}
        </div>
      )}

      <CreditCardFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        card={form.card}
        defaultReminderDays={defaultReminderDays}
      />
      <CardStatementDialog open={Boolean(statement)} onOpenChange={(open) => !open && setStatement(null)} card={statement} />
      <CardPaymentDialog open={Boolean(payment)} onOpenChange={(open) => !open && setPayment(null)} card={payment} />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="¿Eliminar tarjeta?"
        description={
          pendingDelete
            ? `Se eliminará «${pendingDelete.name}» junto con sus compras diferidas. Solo es posible si no tiene cargos, pagos ni gastos recurrentes asociados; si los tiene, desactívala.`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
