"use client";

import {
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Eye,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  Power,
  Scale,
  Trash2,
} from "lucide-react";
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
import { deleteCashBoxAction, setCashBoxActiveAction } from "@/server/actions/cash-boxes";
import type { CashBoxDto, CashBoxOption } from "@/server/queries/cash-boxes";

import { CashBoxCard } from "./cash-box-card";
import { CashBoxFormDialog } from "./cash-box-form-dialog";
import { CashBoxMovementDialog, type CashBoxMovementMode } from "./cash-box-movement-dialog";

type CashBoxesListProps = {
  boxes: CashBoxDto[];
  options: CashBoxOption[];
};

export function CashBoxesList({ boxes, options }: CashBoxesListProps) {
  const [form, setForm] = useState<{ open: boolean; box: CashBoxDto | null }>({ open: false, box: null });
  const [movement, setMovement] = useState<{ mode: CashBoxMovementMode; box: CashBoxDto } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CashBoxDto | null>(null);

  const toggleActive = async (box: CashBoxDto) => {
    const response = await setCashBoxActiveAction(box.id, !box.active);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    toast.success(box.active ? "Caja desactivada" : "Caja activada");
  };

  const remove = async () => {
    if (!pendingDelete) return;
    const response = await deleteCashBoxAction(pendingDelete.id);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    toast.success("Caja eliminada");
  };

  const renderActions = (box: CashBoxDto) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${box.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!box.active} onSelect={() => setMovement({ mode: "DEPOSIT", box })}>
          <ArrowDownToLine aria-hidden="true" />
          Depositar
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!box.active} onSelect={() => setMovement({ mode: "WITHDRAWAL", box })}>
          <ArrowUpFromLine aria-hidden="true" />
          Retirar
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!box.active} onSelect={() => setMovement({ mode: "TRANSFER", box })}>
          <ArrowLeftRight aria-hidden="true" />
          Trasladar
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!box.active} onSelect={() => setMovement({ mode: "ADJUSTMENT", box })}>
          <Scale aria-hidden="true" />
          Ajustar saldo
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/prestamos/cajas/${box.id}`}>
            <Eye aria-hidden="true" />
            Ver detalle
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setForm({ open: true, box })}>
          <Pencil aria-hidden="true" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toggleActive(box)}>
          <Power aria-hidden="true" />
          {box.active ? "Desactivar" : "Activar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(box)}>
          <Trash2 aria-hidden="true" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ open: true, box: null })}>
          <Plus aria-hidden="true" />
          Nueva caja
        </Button>
      </div>

      {boxes.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Aún no hay cajas"
          description="Crea una caja para saber de qué fondo sale cada préstamo y dónde está tu capital."
          action={
            <Button size="sm" onClick={() => setForm({ open: true, box: null })}>
              Crear la primera caja
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {boxes.map((box) => (
            <CashBoxCard key={box.id} box={box} href={`/prestamos/cajas/${box.id}`} actions={renderActions(box)} />
          ))}
        </div>
      )}

      <CashBoxFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        box={form.box}
      />
      <CashBoxMovementDialog
        open={Boolean(movement)}
        onOpenChange={(open) => !open && setMovement(null)}
        mode={movement?.mode ?? "DEPOSIT"}
        box={movement?.box ?? null}
        otherBoxes={options.filter((option) => option.id !== movement?.box.id)}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="¿Eliminar caja?"
        description={
          pendingDelete
            ? `Se eliminará «${pendingDelete.name}». Solo es posible si no tiene préstamos ni movimientos; si los tiene, desactívala para conservar su historial.`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
