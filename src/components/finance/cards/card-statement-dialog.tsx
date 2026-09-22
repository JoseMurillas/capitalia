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
import { handleActionFailure } from "@/lib/forms";
import { type CreditCardStatementInput, creditCardStatementSchema } from "@/lib/validations/credit-card";
import { updateCardStatementAction } from "@/server/actions/credit-cards";
import type { CreditCardDto } from "@/server/queries/credit-cards";

type StatementFormValues = {
  balance: number | "";
  minimumPayment: number | "";
  paymentAmount: number | "";
  nextClosingDate: string;
  nextPaymentDate: string;
};

type CardStatementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCardDto | null;
};

function toFormValues(card: CreditCardDto | null): StatementFormValues {
  return {
    balance: card?.balance ?? 0,
    minimumPayment: card?.minimumPayment ?? "",
    paymentAmount: card?.paymentAmount ?? "",
    nextClosingDate: card?.nextClosingDate ?? "",
    nextPaymentDate: card?.nextPaymentDate ?? "",
  };
}

/** Copies the figures of a new statement onto the card; balance changes are logged as adjustments. */
export function CardStatementDialog({ open, onOpenChange, card }: CardStatementDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<StatementFormValues, unknown, CreditCardStatementInput>({
    resolver: zodResolver(creditCardStatementSchema) as Resolver<StatementFormValues, unknown, CreditCardStatementInput>,
    defaultValues: toFormValues(card),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(card));
  }, [open, card, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (!card) return;
    startTransition(async () => {
      const result = await updateCardStatementAction(card.id, values);
      if (handleActionFailure(form, result)) return;
      toast.success("Extracto actualizado");
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar extracto{card ? ` · ${card.name}` : ""}</DialogTitle>
          <DialogDescription>Copia los valores del extracto. Si el saldo cambia, queda un ajuste en el historial.</DialogDescription>
        </DialogHeader>
        <form id="card-statement-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormItem label="Saldo pendiente" htmlFor="statement-balance" error={errors.balance}>
              <Input id="statement-balance" type="number" inputMode="decimal" min={0} step="1" autoFocus aria-invalid={Boolean(errors.balance)} {...form.register("balance")} />
            </FormItem>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem label="Pago mínimo" htmlFor="statement-minimum" error={errors.minimumPayment}>
                <Input id="statement-minimum" type="number" inputMode="decimal" min={0} step="1" placeholder="Opcional" {...form.register("minimumPayment")} />
              </FormItem>
              <FormItem label="Pago planeado" htmlFor="statement-payment" error={errors.paymentAmount} description="Vacío = el mínimo">
                <Input id="statement-payment" type="number" inputMode="decimal" min={0} step="1" placeholder="Opcional" {...form.register("paymentAmount")} />
              </FormItem>
              <FormItem label="Próximo corte" htmlFor="statement-closing" error={errors.nextClosingDate}>
                <Input id="statement-closing" type="date" {...form.register("nextClosingDate")} />
              </FormItem>
              <FormItem label="Fecha límite de pago" htmlFor="statement-due" error={errors.nextPaymentDate}>
                <Input id="statement-due" type="date" {...form.register("nextPaymentDate")} />
              </FormItem>
            </div>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="card-statement-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            Guardar extracto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
