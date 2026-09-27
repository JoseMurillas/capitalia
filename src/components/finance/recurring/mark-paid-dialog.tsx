"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useTransition } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";

import type { RecurringPaymentMethod } from "@/generated/prisma/enums";
import { AccountField } from "@/components/accounts/account-field";
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
import { Spinner } from "@/components/ui/spinner";
import { formatDate, todayIso } from "@/lib/dates";
import { handleActionFailure } from "@/lib/forms";
import {
  type MarkRecurringPaidInput,
  markRecurringPaidCashSchema,
  markRecurringPaidSchema,
} from "@/lib/validations/recurring";
import { markRecurringPaidAction } from "@/server/actions/recurring";
import type { AccountOption } from "@/server/queries/accounts";

/** What the dialog needs to know; both the list DTO and the overview commitment satisfy it. */
export type MarkPaidTarget = {
  id: string;
  name: string;
  amount: number;
  isVariable: boolean;
  paymentMethod: RecurringPaymentMethod;
  creditCardName: string | null;
  /** The account it is usually paid from, proposed when it pays in cash. */
  accountId: string | null;
};

type MarkPaidFormValues = { amount: number | ""; paidDate: string; accountId: string };

type MarkPaidDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: MarkPaidTarget | null;
  /** Active accounts; only used by the cash branch, where the money really leaves one. */
  accounts: AccountOption[];
};

function toFormValues(target: MarkPaidTarget | null, accounts: AccountOption[] = []): MarkPaidFormValues {
  // The usual account is only proposed while it is still on the list: a
  // deactivated one cannot be picked, and then the user chooses again.
  const usual = target?.accountId && accounts.some((a) => a.id === target.accountId) ? target.accountId : null;
  return {
    amount: target?.amount ?? "",
    paidDate: todayIso(),
    accountId: usual ?? (accounts.length === 1 ? accounts[0].id : ""),
  };
}

export function MarkPaidDialog({ open, onOpenChange, target, accounts }: MarkPaidDialogProps) {
  const [isPending, startTransition] = useTransition();
  const usesCard = target?.paymentMethod === "CREDIT_CARD";
  const hasAccounts = accounts.length > 0;

  // A card charge shows no «Cuenta» field, so its branch must not require one:
  // validating a field nobody can see is what leaves a submit button dead with
  // nothing on screen to fix.
  const resolver = useMemo(
    () =>
      zodResolver(usesCard ? markRecurringPaidSchema : markRecurringPaidCashSchema) as Resolver<
        MarkPaidFormValues,
        unknown,
        MarkRecurringPaidInput
      >,
    [usesCard],
  );

  const form = useForm<MarkPaidFormValues, unknown, MarkRecurringPaidInput>({
    resolver,
    defaultValues: toFormValues(target, accounts),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(target, accounts));
  }, [open, target, accounts, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (!target) return;
    startTransition(async () => {
      const result = await markRecurringPaidAction(target.id, values);
      // The server keys its refusal to `accountId`, and in the card branch that
      // field is not on screen — `handleActionFailure` would put the message on
      // a control nobody can see and show no toast, leaving the button silent.
      if (!result.success && usesCard && result.fieldErrors?.accountId) {
        toast.error(result.error);
        return;
      }
      if (handleActionFailure(form, result)) return;
      toast.success(
        result.data.chargedToCard
          ? `Cargado a ${result.data.chargedToCard}. Próximo pago: ${formatDate(result.data.nextDueDate)}`
          : `Pago registrado. Próximo pago: ${formatDate(result.data.nextDueDate)}`,
      );
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar pagado{target ? ` · ${target.name}` : ""}</DialogTitle>
          <DialogDescription>
            {usesCard
              ? `Se cargará a la tarjeta ${target?.creditCardName ?? ""}; no sale de tu caja hasta que pagues la tarjeta.`
              : "Se registrará un gasto en Finanzas con este monto, saldrá de la cuenta que elijas y la próxima fecha avanzará un periodo."}
          </DialogDescription>
        </DialogHeader>
        <form id="mark-paid-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem
                label="Monto"
                htmlFor="mark-paid-amount"
                error={errors.amount}
                description={target?.isVariable ? "Valor variable: escribe lo que pagaste realmente." : undefined}
              >
                <Input id="mark-paid-amount" type="number" inputMode="decimal" min={1} step="1" autoFocus aria-invalid={Boolean(errors.amount)} {...form.register("amount")} />
              </FormItem>
              <FormItem label="Fecha" htmlFor="mark-paid-date" error={errors.paidDate}>
                <Input id="mark-paid-date" type="date" aria-invalid={Boolean(errors.paidDate)} {...form.register("paidDate")} />
              </FormItem>
            </div>
            {usesCard ? null : (
              <Controller
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <AccountField
                    id="mark-paid-account"
                    accounts={accounts}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.accountId}
                  />
                )}
              />
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          {/* Only the cash branch needs an account, so only it waits for one. */}
          <Button type="submit" form="mark-paid-form" disabled={isPending || (!usesCard && !hasAccounts)}>
            {isPending ? <Spinner /> : null}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
