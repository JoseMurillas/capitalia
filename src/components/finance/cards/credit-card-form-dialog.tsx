"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { type Resolver, useForm } from "react-hook-form";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { addDaysIso, todayIso } from "@/lib/dates";
import { handleActionFailure } from "@/lib/forms";
import { type CreditCardInput, creditCardSchema } from "@/lib/validations/credit-card";
import { createCreditCardAction, updateCreditCardAction } from "@/server/actions/credit-cards";
import type { CreditCardDto } from "@/server/queries/credit-cards";
import type { ActionResult } from "@/types";

type CardFormValues = {
  name: string;
  creditLimit: number | "";
  balance: number | "";
  minimumPayment: number | "";
  paymentAmount: number | "";
  nextClosingDate: string;
  nextPaymentDate: string;
  reminderDays: number | "";
  notes: string;
};

type CreditCardFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing card; otherwise a new one is created. */
  card?: CreditCardDto | null;
  defaultReminderDays: number;
};

function toFormValues(card: CreditCardDto | null | undefined, defaultReminderDays: number): CardFormValues {
  const today = todayIso();
  return {
    name: card?.name ?? "",
    creditLimit: card?.creditLimit ?? "",
    balance: card?.balance ?? 0,
    minimumPayment: card?.minimumPayment ?? "",
    paymentAmount: card?.paymentAmount ?? "",
    nextClosingDate: card?.nextClosingDate ?? today,
    nextPaymentDate: card?.nextPaymentDate ?? addDaysIso(today, 15),
    reminderDays: card?.reminderDays ?? defaultReminderDays,
    notes: card?.notes ?? "",
  };
}

export function CreditCardFormDialog({ open, onOpenChange, card, defaultReminderDays }: CreditCardFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(card);

  const form = useForm<CardFormValues, unknown, CreditCardInput>({
    resolver: zodResolver(creditCardSchema) as Resolver<CardFormValues, unknown, CreditCardInput>,
    defaultValues: toFormValues(card, defaultReminderDays),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(card, defaultReminderDays));
  }, [open, card, defaultReminderDays, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result: ActionResult<unknown> = card
        ? await updateCreditCardAction(card.id, values)
        : await createCreditCardAction(values);
      if (handleActionFailure(form, result)) return;
      toast.success(isEdit ? "Tarjeta actualizada" : "Tarjeta registrada");
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tarjeta" : "Nueva tarjeta de crédito"}</DialogTitle>
          <DialogDescription>
            El cupo es una obligación, no dinero disponible. Toma saldo, mínimo y fechas de tu último extracto.
          </DialogDescription>
        </DialogHeader>
        <form id="credit-card-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormItem label="Nombre o banco" htmlFor="card-name" error={errors.name}>
              <Input id="card-name" placeholder="Visa Bancolombia" autoFocus aria-invalid={Boolean(errors.name)} {...form.register("name")} />
            </FormItem>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem label="Cupo total" htmlFor="card-limit" error={errors.creditLimit}>
                <Input id="card-limit" type="number" inputMode="decimal" min={1} step="1" aria-invalid={Boolean(errors.creditLimit)} {...form.register("creditLimit")} />
              </FormItem>
              <FormItem label="Saldo pendiente" htmlFor="card-balance" error={errors.balance} description="Cupo utilizado hoy">
                <Input id="card-balance" type="number" inputMode="decimal" min={0} step="1" aria-invalid={Boolean(errors.balance)} {...form.register("balance")} />
              </FormItem>
              <FormItem label="Pago mínimo" htmlFor="card-minimum" error={errors.minimumPayment}>
                <Input id="card-minimum" type="number" inputMode="decimal" min={0} step="1" placeholder="Opcional" aria-invalid={Boolean(errors.minimumPayment)} {...form.register("minimumPayment")} />
              </FormItem>
              <FormItem label="Pago planeado" htmlFor="card-payment" error={errors.paymentAmount} description="Vacío = pagar el mínimo">
                <Input id="card-payment" type="number" inputMode="decimal" min={0} step="1" placeholder="Opcional" aria-invalid={Boolean(errors.paymentAmount)} {...form.register("paymentAmount")} />
              </FormItem>
              <FormItem label="Fecha de corte" htmlFor="card-closing" error={errors.nextClosingDate}>
                <Input id="card-closing" type="date" aria-invalid={Boolean(errors.nextClosingDate)} {...form.register("nextClosingDate")} />
              </FormItem>
              <FormItem label="Fecha límite de pago" htmlFor="card-due" error={errors.nextPaymentDate}>
                <Input id="card-due" type="date" aria-invalid={Boolean(errors.nextPaymentDate)} {...form.register("nextPaymentDate")} />
              </FormItem>
              <FormItem label="Avisar (días antes)" htmlFor="card-reminder" error={errors.reminderDays}>
                <Input id="card-reminder" type="number" inputMode="numeric" min={0} max={60} aria-invalid={Boolean(errors.reminderDays)} {...form.register("reminderDays")} />
              </FormItem>
            </div>

            <FormItem label="Notas" htmlFor="card-notes" error={errors.notes}>
              <Textarea id="card-notes" rows={2} {...form.register("notes")} />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="credit-card-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            {isEdit ? "Guardar cambios" : "Registrar tarjeta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
