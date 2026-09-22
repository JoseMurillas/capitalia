"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormItem } from "@/components/shared/form-item";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { handleActionFailure } from "@/lib/forms";
import { CASH_BOX_COUNTERPARTY_LABELS } from "@/lib/labels";
import {
  CASH_BOX_COUNTERPARTIES,
  cashBoxAdjustmentSchema,
  cashBoxMovementSchema,
  cashBoxTransferSchema,
} from "@/lib/validations/cash-box";
import {
  adjustCashBoxAction,
  depositToCashBoxAction,
  transferBetweenCashBoxesAction,
  withdrawFromCashBoxAction,
} from "@/server/actions/cash-boxes";
import type { CashBoxDto, CashBoxOption } from "@/server/queries/cash-boxes";
import type { ActionResult } from "@/types";

export type CashBoxMovementMode = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "ADJUSTMENT";

type MovementFormValues = {
  amount: number | "";
  movementDate: string;
  counterparty: (typeof CASH_BOX_COUNTERPARTIES)[number];
  toCashBoxId: string;
  description: string;
  notes: string;
};

type CashBoxMovementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CashBoxMovementMode;
  box: CashBoxDto | null;
  /** Active boxes other than this one, for transfers. */
  otherBoxes: CashBoxOption[];
};

const COPY: Record<CashBoxMovementMode, { title: string; description: string; submit: string; success: string }> = {
  DEPOSIT: {
    title: "Depositar capital",
    description: "Suma dinero a la caja e indica de dónde viene.",
    submit: "Depositar",
    success: "Depósito registrado",
  },
  WITHDRAWAL: {
    title: "Retirar capital",
    description: "Saca dinero de la caja e indica a dónde va.",
    submit: "Retirar",
    success: "Retiro registrado",
  },
  TRANSFER: {
    title: "Trasladar a otra caja",
    description: "Mueve capital entre cajas; queda registrado en el historial de ambas.",
    submit: "Trasladar",
    success: "Traslado registrado",
  },
  ADJUSTMENT: {
    title: "Ajustar saldo",
    description: "Corrige una diferencia real. Usa un monto negativo para restar.",
    submit: "Registrar ajuste",
    success: "Ajuste registrado",
  },
};

function schemaFor(mode: CashBoxMovementMode) {
  if (mode === "TRANSFER") return cashBoxTransferSchema;
  if (mode === "ADJUSTMENT") return cashBoxAdjustmentSchema;
  return cashBoxMovementSchema;
}

function toFormValues(mode: CashBoxMovementMode): MovementFormValues {
  return {
    amount: "",
    movementDate: todayIso(),
    counterparty: mode === "WITHDRAWAL" ? "PERSONAL_FINANCES" : "EXTERNAL",
    toCashBoxId: "",
    description: "",
    notes: "",
  };
}

export function CashBoxMovementDialog({ open, onOpenChange, mode, box, otherBoxes }: CashBoxMovementDialogProps) {
  const [isPending, startTransition] = useTransition();
  const copy = COPY[mode];

  const form = useForm<MovementFormValues>({
    resolver: zodResolver(schemaFor(mode)) as unknown as Resolver<MovementFormValues>,
    defaultValues: toFormValues(mode),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(mode));
  }, [open, mode, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (!box) return;
    startTransition(async () => {
      let result: ActionResult<unknown>;
      if (mode === "DEPOSIT") {
        result = await depositToCashBoxAction(box.id, values);
      } else if (mode === "WITHDRAWAL") {
        result = await withdrawFromCashBoxAction(box.id, values);
      } else if (mode === "TRANSFER") {
        result = await transferBetweenCashBoxesAction(box.id, values);
      } else {
        result = await adjustCashBoxAction(box.id, values);
      }
      if (handleActionFailure(form, result)) return;
      toast.success(copy.success);
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {copy.title}
            {box ? ` · ${box.name}` : ""}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form id="cash-box-movement-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem
                label="Monto"
                htmlFor="movement-amount"
                error={errors.amount}
                description={
                  box ? (
                    <>
                      Disponible <MoneyDisplay value={box.available} />
                    </>
                  ) : undefined
                }
              >
                <Input
                  id="movement-amount"
                  type="number"
                  inputMode="decimal"
                  step="1"
                  autoFocus
                  aria-invalid={Boolean(errors.amount)}
                  {...form.register("amount")}
                />
              </FormItem>
              <FormItem label="Fecha" htmlFor="movement-date" error={errors.movementDate}>
                <Input id="movement-date" type="date" aria-invalid={Boolean(errors.movementDate)} {...form.register("movementDate")} />
              </FormItem>
            </div>

            {mode === "DEPOSIT" || mode === "WITHDRAWAL" ? (
              <FormItem
                label={mode === "DEPOSIT" ? "Origen del dinero" : "Destino del dinero"}
                htmlFor="movement-counterparty"
                error={errors.counterparty}
                description="Si eliges finanzas personales, tu efectivo personal se ajusta sin crear un movimiento en la tabla de Movimientos."
              >
                <Controller
                  control={form.control}
                  name="counterparty"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="movement-counterparty" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CASH_BOX_COUNTERPARTIES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {CASH_BOX_COUNTERPARTY_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormItem>
            ) : null}

            {mode === "TRANSFER" ? (
              <FormItem
                label="Caja destino"
                htmlFor="movement-target"
                error={errors.toCashBoxId}
                description={otherBoxes.length === 0 ? "Necesitas al menos dos cajas activas." : undefined}
              >
                <Controller
                  control={form.control}
                  name="toCashBoxId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={otherBoxes.length === 0}>
                      <SelectTrigger id="movement-target" className="w-full" aria-invalid={Boolean(errors.toCashBoxId)}>
                        <SelectValue placeholder="Elige la caja" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherBoxes.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name} — {formatMoney(option.available)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormItem>
            ) : null}

            {mode === "ADJUSTMENT" ? null : (
              <FormItem label="Concepto" htmlFor="movement-description" error={errors.description}>
                <Input id="movement-description" placeholder="Opcional" {...form.register("description")} />
              </FormItem>
            )}

            <FormItem
              label={mode === "ADJUSTMENT" ? "Motivo del ajuste" : "Notas"}
              htmlFor="movement-notes"
              error={errors.notes}
            >
              <Textarea id="movement-notes" rows={2} aria-invalid={Boolean(errors.notes)} {...form.register("notes")} />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="cash-box-movement-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            {copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
