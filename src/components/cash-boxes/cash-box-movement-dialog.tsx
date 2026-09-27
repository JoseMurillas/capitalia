"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { AccountField } from "@/components/accounts/account-field";
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
import type { AccountOption } from "@/server/queries/accounts";
import type { CashBoxDto, CashBoxOption } from "@/server/queries/cash-boxes";
import type { ActionResult } from "@/types";

export type CashBoxMovementMode = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "ADJUSTMENT";

type MovementFormValues = {
  amount: number | "";
  movementDate: string;
  counterparty: (typeof CASH_BOX_COUNTERPARTIES)[number];
  accountId: string;
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
  /** Active accounts; only the personal-finances branch moves money in one. */
  accounts: AccountOption[];
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

function toFormValues(mode: CashBoxMovementMode, accounts: AccountOption[]): MovementFormValues {
  return {
    amount: "",
    movementDate: todayIso(),
    counterparty: mode === "WITHDRAWAL" ? "PERSONAL_FINANCES" : "EXTERNAL",
    // With a single account there is nothing to choose; anything else is the
    // user's call and stays empty on purpose.
    accountId: accounts.length === 1 ? accounts[0].id : "",
    toCashBoxId: "",
    description: "",
    notes: "",
  };
}

export function CashBoxMovementDialog({
  open,
  onOpenChange,
  mode,
  box,
  otherBoxes,
  accounts,
}: CashBoxMovementDialogProps) {
  const [isPending, startTransition] = useTransition();
  const copy = COPY[mode];

  const form = useForm<MovementFormValues>({
    resolver: zodResolver(schemaFor(mode)) as unknown as Resolver<MovementFormValues>,
    defaultValues: toFormValues(mode, accounts),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(mode, accounts));
  }, [open, mode, accounts, form]);

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
  const counterparty = useWatch({ control: form.control, name: "counterparty" });
  const isCapitalMove = mode === "DEPOSIT" || mode === "WITHDRAWAL";
  // The «Cuenta» field appears and disappears with the chosen counterparty, and
  // the schema asks for it in exactly that case: a field that is validated has
  // to be on screen, or Guardar dies with nothing explaining why.
  const needsAccount = isCapitalMove && counterparty === "PERSONAL_FINANCES";

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

            {isCapitalMove ? (
              <FormItem
                label={mode === "DEPOSIT" ? "Origen del dinero" : "Destino del dinero"}
                htmlFor="movement-counterparty"
                error={errors.counterparty}
                description="Si eliges finanzas personales, el movimiento queda también en el historial de la cuenta que indiques."
              >
                <Controller
                  control={form.control}
                  name="counterparty"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="movement-counterparty" className="w-full" aria-invalid={Boolean(errors.counterparty)}>
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

            {needsAccount ? (
              <Controller
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <AccountField
                    id="movement-account"
                    accounts={accounts}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.accountId}
                  />
                )}
              />
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
                <Input
                  id="movement-description"
                  placeholder="Opcional"
                  aria-invalid={Boolean(errors.description)}
                  {...form.register("description")}
                />
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
          {/* Only the branch that needs an account waits for one to exist. */}
          <Button
            type="submit"
            form="cash-box-movement-form"
            disabled={isPending || (needsAccount && accounts.length === 0)}
          >
            {isPending ? <Spinner /> : null}
            {copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
