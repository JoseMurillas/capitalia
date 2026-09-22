"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FormItem } from "@/components/shared/form-item";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { handleActionFailure } from "@/lib/forms";
import { type CreditCardPaymentInput, creditCardPaymentSchema } from "@/lib/validations/credit-card";
import { registerCardPaymentAction } from "@/server/actions/credit-cards";

/** The minimum a caller must know about a card to pay it (list, detail and overview all qualify). */
export type CardPaymentTarget = { id: string; name: string; balance: number; suggestedPayment: number };

type PaymentFormValues = {
  amount: number | "";
  paidDate: string;
  notes: string;
  advanceCycle: boolean;
};

type CardPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CardPaymentTarget | null;
};

function toFormValues(card: CardPaymentTarget | null): PaymentFormValues {
  const suggested = card ? (card.suggestedPayment > 0 ? card.suggestedPayment : card.balance) : "";
  return { amount: suggested, paidDate: todayIso(), notes: "", advanceCycle: true };
}

export function CardPaymentDialog({ open, onOpenChange, card }: CardPaymentDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<PaymentFormValues, unknown, CreditCardPaymentInput>({
    resolver: zodResolver(creditCardPaymentSchema) as Resolver<PaymentFormValues, unknown, CreditCardPaymentInput>,
    defaultValues: toFormValues(card),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(card));
  }, [open, card, form]);

  const amount = Number(useWatch({ control: form.control, name: "amount" }) || 0);
  const exceedsBalance = card !== null && amount > card.balance;

  const onSubmit = form.handleSubmit((values) => {
    if (!card) return;
    startTransition(async () => {
      const result = await registerCardPaymentAction(card.id, values);
      if (handleActionFailure(form, result)) return;
      toast.success(`Pago registrado. Saldo de ${card.name}: ${formatMoney(result.data.newBalance)}`);
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago{card ? ` · ${card.name}` : ""}</DialogTitle>
          <DialogDescription>
            Se registrará un gasto «Pago tarjeta {card?.name ?? ""}» en Finanzas y el saldo de la tarjeta bajará.
          </DialogDescription>
        </DialogHeader>
        <form id="card-payment-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem
                label="Monto"
                htmlFor="card-payment-amount"
                error={errors.amount}
                description={
                  card ? (
                    <>
                      Saldo actual <MoneyDisplay value={card.balance} />
                    </>
                  ) : undefined
                }
              >
                <Input id="card-payment-amount" type="number" inputMode="decimal" min={1} step="1" autoFocus aria-invalid={Boolean(errors.amount)} {...form.register("amount")} />
              </FormItem>
              <FormItem label="Fecha" htmlFor="card-payment-date" error={errors.paidDate}>
                <Input id="card-payment-date" type="date" aria-invalid={Boolean(errors.paidDate)} {...form.register("paidDate")} />
              </FormItem>
            </div>
            {exceedsBalance ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                El pago supera el saldo pendiente; la tarjeta quedará en $0.
              </p>
            ) : null}

            <Controller
              control={form.control}
              name="advanceCycle"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox id="card-payment-advance" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  <FieldLabel htmlFor="card-payment-advance" className="font-normal">
                    Avanzar al siguiente ciclo (corte y fecha límite +1 mes; suma una cuota a las compras diferidas)
                  </FieldLabel>
                </Field>
              )}
            />

            <FormItem label="Notas" htmlFor="card-payment-notes" error={errors.notes}>
              <Textarea id="card-payment-notes" rows={2} {...form.register("notes")} />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="card-payment-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
