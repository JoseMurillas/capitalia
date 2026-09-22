"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";

import type { RecurringPaymentMethod } from "@/generated/prisma/enums";
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
import { type MarkRecurringPaidInput, markRecurringPaidSchema } from "@/lib/validations/recurring";
import { markRecurringPaidAction } from "@/server/actions/recurring";

/** What the dialog needs to know; both the list DTO and the overview commitment satisfy it. */
export type MarkPaidTarget = {
  id: string;
  name: string;
  amount: number;
  isVariable: boolean;
  paymentMethod: RecurringPaymentMethod;
  creditCardName: string | null;
};

type MarkPaidFormValues = { amount: number | ""; paidDate: string };

type MarkPaidDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: MarkPaidTarget | null;
};

function toFormValues(target: MarkPaidTarget | null): MarkPaidFormValues {
  return { amount: target?.amount ?? "", paidDate: todayIso() };
}

export function MarkPaidDialog({ open, onOpenChange, target }: MarkPaidDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<MarkPaidFormValues, unknown, MarkRecurringPaidInput>({
    resolver: zodResolver(markRecurringPaidSchema) as Resolver<MarkPaidFormValues, unknown, MarkRecurringPaidInput>,
    defaultValues: toFormValues(target),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(target));
  }, [open, target, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (!target) return;
    startTransition(async () => {
      const result = await markRecurringPaidAction(target.id, values);
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
  const usesCard = target?.paymentMethod === "CREDIT_CARD";

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar pagado{target ? ` · ${target.name}` : ""}</DialogTitle>
          <DialogDescription>
            {usesCard
              ? `Se cargará a la tarjeta ${target?.creditCardName ?? ""}; no sale de tu caja hasta que pagues la tarjeta.`
              : "Se registrará un gasto en Finanzas con este monto y la próxima fecha avanzará un periodo."}
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
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="mark-paid-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
