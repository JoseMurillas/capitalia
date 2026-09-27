"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FormItem } from "@/components/shared/form-item";
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
import {
  ACCOUNT_KINDS,
  type AccountKindValue,
  type CreateAccountInput,
  createAccountSchema,
} from "@/lib/validations/account";
import { createAccountAction, updateAccountAction } from "@/server/actions/accounts";
import type { AccountDto } from "@/server/queries/accounts";
import type { ActionResult } from "@/types";

type AccountFormValues = {
  name: string;
  kind: AccountKindValue;
  issuer: string;
  last4: string;
  notes: string;
  openingBalance: number | "";
  openingDate: string;
};

type AccountFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing account; otherwise a new one is created. */
  account?: AccountDto | null;
};

function toFormValues(account: AccountDto | null | undefined): AccountFormValues {
  return {
    name: account?.name ?? "",
    kind: account?.kind ?? "DEBIT",
    issuer: account?.issuer ?? "",
    last4: account?.last4 ?? "",
    notes: account?.notes ?? "",
    // Editing never writes to the ledger, so the opening fields validate as a no-op.
    openingBalance: account ? 0 : "",
    openingDate: todayIso(),
  };
}

export function AccountFormDialog({ open, onOpenChange, account }: AccountFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(account);

  const form = useForm<AccountFormValues, unknown, CreateAccountInput>({
    resolver: zodResolver(createAccountSchema) as Resolver<AccountFormValues, unknown, CreateAccountInput>,
    defaultValues: toFormValues(account),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(account));
  }, [open, account, form]);

  // Only a debit card has digits to ask for, so the field follows the kind.
  const kind = useWatch({ control: form.control, name: "kind" });
  const isCard = kind === "DEBIT";

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      // The card digits only belong to a debit card: any other kind clears them,
      // so switching the kind never leaves a stale number behind.
      const details = {
        name: values.name,
        kind: values.kind,
        issuer: values.issuer,
        last4: values.kind === "DEBIT" ? values.last4 : null,
        notes: values.notes,
      };
      const result: ActionResult<unknown> = account
        ? await updateAccountAction(account.id, details)
        : await createAccountAction({
            ...details,
            openingBalance: values.openingBalance,
            openingDate: values.openingDate,
          });
      if (handleActionFailure(form, result)) return;
      toast.success(isEdit ? "Cuenta actualizada" : "Cuenta creada");
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          <DialogDescription>
            Un sitio donde tienes dinero. Su saldo es la suma de todo lo que pasa por ella.
          </DialogDescription>
        </DialogHeader>
        <form id="account-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormItem label="Nombre" htmlFor="account-name" error={errors.name}>
              <Input
                id="account-name"
                placeholder="Bancolombia débito"
                autoFocus
                aria-invalid={Boolean(errors.name)}
                {...form.register("name")}
              />
            </FormItem>

            <FormItem label="Tipo" htmlFor="account-kind" error={errors.kind}>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="account-kind" className="w-full" aria-invalid={Boolean(errors.kind)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_KINDS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {ACCOUNT_KIND_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormItem>

            <div className={isCard ? "grid gap-4 sm:grid-cols-2" : undefined}>
              <FormItem label="Banco o proveedor" htmlFor="account-issuer" error={errors.issuer}>
                <Input
                  id="account-issuer"
                  placeholder="Opcional"
                  aria-invalid={Boolean(errors.issuer)}
                  {...form.register("issuer")}
                />
              </FormItem>
              {isCard ? (
                <FormItem label="Últimos 4 dígitos" htmlFor="account-last4" error={errors.last4}>
                  <Input
                    id="account-last4"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Opcional"
                    aria-invalid={Boolean(errors.last4)}
                    {...form.register("last4")}
                  />
                </FormItem>
              ) : null}
            </div>

            {isEdit ? null : (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormItem
                  label="Saldo inicial"
                  htmlFor="account-opening"
                  error={errors.openingBalance}
                  description="Cuánto tiene hoy. Puedes dejar 0."
                >
                  <Input
                    id="account-opening"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="1"
                    aria-invalid={Boolean(errors.openingBalance)}
                    {...form.register("openingBalance")}
                  />
                </FormItem>
                <FormItem label="Fecha del saldo" htmlFor="account-opening-date" error={errors.openingDate}>
                  <Input
                    id="account-opening-date"
                    type="date"
                    aria-invalid={Boolean(errors.openingDate)}
                    {...form.register("openingDate")}
                  />
                </FormItem>
              </div>
            )}

            <FormItem label="Notas" htmlFor="account-notes" error={errors.notes}>
              <Textarea id="account-notes" rows={2} aria-invalid={Boolean(errors.notes)} {...form.register("notes")} />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="account-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            {isEdit ? "Guardar cambios" : "Crear cuenta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
