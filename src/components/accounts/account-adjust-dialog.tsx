"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { type Resolver, useForm } from "react-hook-form";
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
import { Spinner } from "@/components/ui/spinner";
import { todayIso } from "@/lib/dates";
import { handleActionFailure } from "@/lib/forms";
import { type AccountAdjustmentInput, accountAdjustmentSchema } from "@/lib/validations/account";
import { adjustAccountAction } from "@/server/actions/accounts";
import type { AccountDto } from "@/server/queries/accounts";

type AdjustFormValues = {
  amount: number | "";
  movementDate: string;
  description: string;
};

type AccountAdjustDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountDto | null;
};

function toFormValues(): AdjustFormValues {
  return { amount: "", movementDate: todayIso(), description: "" };
}

/** Corrects a real difference between the app and the account, in either direction. */
export function AccountAdjustDialog({ open, onOpenChange, account }: AccountAdjustDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<AdjustFormValues, unknown, AccountAdjustmentInput>({
    resolver: zodResolver(accountAdjustmentSchema) as Resolver<AdjustFormValues, unknown, AccountAdjustmentInput>,
    defaultValues: toFormValues(),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues());
  }, [open, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (!account) return;
    startTransition(async () => {
      const result = await adjustAccountAction(account.id, values);
      if (handleActionFailure(form, result)) return;
      toast.success("Ajuste registrado");
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Ajustar saldo
            {account ? ` · ${account.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Corrige una diferencia real con lo que dice el banco. Usa un monto negativo para restar.
          </DialogDescription>
        </DialogHeader>
        <form id="account-adjust-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem
                label="Monto"
                htmlFor="adjust-amount"
                error={errors.amount}
                description={
                  account ? (
                    <>
                      Saldo actual{" "}
                      <MoneyDisplay value={account.balance} tone={account.balance < 0 ? "negative" : "neutral"} />
                    </>
                  ) : undefined
                }
              >
                <Input
                  id="adjust-amount"
                  type="number"
                  inputMode="decimal"
                  step="1"
                  autoFocus
                  aria-invalid={Boolean(errors.amount)}
                  {...form.register("amount")}
                />
              </FormItem>
              <FormItem label="Fecha" htmlFor="adjust-date" error={errors.movementDate}>
                <Input
                  id="adjust-date"
                  type="date"
                  aria-invalid={Boolean(errors.movementDate)}
                  {...form.register("movementDate")}
                />
              </FormItem>
            </div>

            <FormItem
              label="Motivo del ajuste"
              htmlFor="adjust-description"
              error={errors.description}
              description="Queda en el historial de la cuenta, así que di qué pasó."
            >
              <Input
                id="adjust-description"
                placeholder="Diferencia con el extracto"
                aria-invalid={Boolean(errors.description)}
                {...form.register("description")}
              />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="account-adjust-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            Registrar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
