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
import { handleActionFailure } from "@/lib/forms";
import { ACCOUNT_KIND_LABELS } from "@/lib/labels";
import { type AccountTransferInput, accountTransferSchema } from "@/lib/validations/account";
import { transferBetweenAccountsAction } from "@/server/actions/accounts";
import type { AccountDto, AccountOption } from "@/server/queries/accounts";

type TransferFormValues = {
  toAccountId: string;
  amount: number | "";
  movementDate: string;
  description: string;
  notes: string;
};

type AccountTransferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountDto | null;
  /** Active accounts other than this one; a transfer needs somewhere to land. */
  otherAccounts: AccountOption[];
};

function toFormValues(): TransferFormValues {
  return { toAccountId: "", amount: "", movementDate: todayIso(), description: "", notes: "" };
}

/** Moves money between two of your own accounts: one leg out, one leg in. */
export function AccountTransferDialog({ open, onOpenChange, account, otherAccounts }: AccountTransferDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<TransferFormValues, unknown, AccountTransferInput>({
    resolver: zodResolver(accountTransferSchema) as Resolver<TransferFormValues, unknown, AccountTransferInput>,
    defaultValues: toFormValues(),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues());
  }, [open, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (!account) return;
    startTransition(async () => {
      const result = await transferBetweenAccountsAction(account.id, values);
      if (handleActionFailure(form, result)) return;
      toast.success("Transferencia registrada");
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;
  const noTargets = otherAccounts.length === 0;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Transferir
            {account ? ` · ${account.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Mueve dinero a otra de tus cuentas. Queda registrado en el historial de las dos.
          </DialogDescription>
        </DialogHeader>
        <form id="account-transfer-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem
                label="Monto"
                htmlFor="transfer-amount"
                error={errors.amount}
                description={
                  account ? (
                    <>
                      Saldo <MoneyDisplay value={account.balance} tone={account.balance < 0 ? "negative" : "neutral"} />
                    </>
                  ) : undefined
                }
              >
                <Input
                  id="transfer-amount"
                  type="number"
                  inputMode="decimal"
                  step="1"
                  autoFocus
                  aria-invalid={Boolean(errors.amount)}
                  {...form.register("amount")}
                />
              </FormItem>
              <FormItem label="Fecha" htmlFor="transfer-date" error={errors.movementDate}>
                <Input
                  id="transfer-date"
                  type="date"
                  aria-invalid={Boolean(errors.movementDate)}
                  {...form.register("movementDate")}
                />
              </FormItem>
            </div>

            <FormItem
              label="Cuenta destino"
              htmlFor="transfer-target"
              error={errors.toAccountId}
              description={noTargets ? "Necesitas al menos dos cuentas activas." : undefined}
            >
              <Controller
                control={form.control}
                name="toAccountId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={noTargets}>
                    <SelectTrigger id="transfer-target" className="w-full" aria-invalid={Boolean(errors.toAccountId)}>
                      <SelectValue placeholder="Elige la cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherAccounts.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name} — {ACCOUNT_KIND_LABELS[option.kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormItem>

            <FormItem label="Concepto" htmlFor="transfer-description" error={errors.description}>
              <Input
                id="transfer-description"
                placeholder="Opcional"
                aria-invalid={Boolean(errors.description)}
                {...form.register("description")}
              />
            </FormItem>

            <FormItem label="Notas" htmlFor="transfer-notes" error={errors.notes}>
              <Textarea
                id="transfer-notes"
                rows={2}
                aria-invalid={Boolean(errors.notes)}
                {...form.register("notes")}
              />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="account-transfer-form" disabled={isPending || noTargets}>
            {isPending ? <Spinner /> : null}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
