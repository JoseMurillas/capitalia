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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { RecurringFrequencyValue } from "@/lib/calculations/recurring";
import { todayIso } from "@/lib/dates";
import { handleActionFailure } from "@/lib/forms";
import {
  RECURRING_FREQUENCY_LABELS,
  RECURRING_PAYMENT_METHOD_LABELS,
  TRANSACTION_CATEGORY_LABELS,
} from "@/lib/labels";
import {
  RECURRING_FREQUENCIES,
  RECURRING_PAYMENT_METHODS,
  type RecurringExpenseInput,
  type RecurringPaymentMethodValue,
  recurringExpenseSchema,
} from "@/lib/validations/recurring";
import { EXPENSE_CATEGORIES, type ExpenseCategoryValue } from "@/lib/validations/transaction";
import { createRecurringExpenseAction, updateRecurringExpenseAction } from "@/server/actions/recurring";
import type { CreditCardOption } from "@/server/queries/credit-cards";
import type { RecurringExpenseDto } from "@/server/queries/recurring";
import type { ActionResult } from "@/types";

type RecurringFormValues = {
  name: string;
  category: ExpenseCategoryValue | "";
  amount: number | "";
  isVariable: boolean;
  frequency: RecurringFrequencyValue;
  customIntervalDays: number | "";
  nextDueDate: string;
  paymentMethod: RecurringPaymentMethodValue;
  creditCardId: string;
  reminderDays: number | "";
  notes: string;
};

type RecurringFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing expense; otherwise a new one is created. */
  expense?: RecurringExpenseDto | null;
  /** Active credit cards for the CREDIT_CARD payment method. */
  cards: CreditCardOption[];
  defaultReminderDays: number;
};

function toFormValues(expense: RecurringExpenseDto | null | undefined, defaultReminderDays: number): RecurringFormValues {
  return {
    name: expense?.name ?? "",
    category: (expense?.category as ExpenseCategoryValue | undefined) ?? "",
    amount: expense?.amount ?? "",
    isVariable: expense?.isVariable ?? false,
    frequency: expense?.frequency ?? "MONTHLY",
    customIntervalDays: expense?.customIntervalDays ?? "",
    nextDueDate: expense?.nextDueDate ?? todayIso(),
    paymentMethod: expense?.paymentMethod ?? "BANK_TRANSFER",
    creditCardId: expense?.creditCardId ?? "",
    reminderDays: expense?.reminderDays ?? defaultReminderDays,
    notes: expense?.notes ?? "",
  };
}

export function RecurringFormDialog({ open, onOpenChange, expense, cards, defaultReminderDays }: RecurringFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(expense);

  const form = useForm<RecurringFormValues, unknown, RecurringExpenseInput>({
    resolver: zodResolver(recurringExpenseSchema) as Resolver<RecurringFormValues, unknown, RecurringExpenseInput>,
    defaultValues: toFormValues(expense, defaultReminderDays),
  });

  const frequency = useWatch({ control: form.control, name: "frequency" });
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" });

  useEffect(() => {
    if (open) form.reset(toFormValues(expense, defaultReminderDays));
  }, [open, expense, defaultReminderDays, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result: ActionResult<unknown> = expense
        ? await updateRecurringExpenseAction(expense.id, values)
        : await createRecurringExpenseAction(values);
      if (handleActionFailure(form, result)) return;
      toast.success(isEdit ? "Gasto recurrente actualizado" : "Gasto recurrente registrado");
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar gasto recurrente" : "Nuevo gasto recurrente"}</DialogTitle>
          <DialogDescription>Pagos que se repiten: arriendo, servicios, suscripciones, seguros, cuotas…</DialogDescription>
        </DialogHeader>
        <form id="recurring-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormItem label="Nombre" htmlFor="recurring-name" error={errors.name}>
              <Input id="recurring-name" placeholder="Internet, Netflix, Arriendo…" autoFocus aria-invalid={Boolean(errors.name)} {...form.register("name")} />
            </FormItem>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem label="Categoría" htmlFor="recurring-category" error={errors.category}>
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="recurring-category" className="w-full" aria-invalid={Boolean(errors.category)}>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {TRANSACTION_CATEGORY_LABELS[category]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormItem>
              <FormItem label="Valor" htmlFor="recurring-amount" error={errors.amount}>
                <Input id="recurring-amount" type="number" inputMode="decimal" min={1} step="1" aria-invalid={Boolean(errors.amount)} {...form.register("amount")} />
              </FormItem>
            </div>

            <Controller
              control={form.control}
              name="isVariable"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Switch id="recurring-variable" checked={field.value} onCheckedChange={field.onChange} />
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel htmlFor="recurring-variable">Valor variable</FieldLabel>
                    <FieldDescription>El monto cambia cada periodo (energía, agua); el valor es un estimado.</FieldDescription>
                  </div>
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem label="Frecuencia" htmlFor="recurring-frequency" error={errors.frequency}>
                <Controller
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="recurring-frequency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRING_FREQUENCIES.map((frequency) => (
                          <SelectItem key={frequency} value={frequency}>
                            {RECURRING_FREQUENCY_LABELS[frequency]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormItem>
              {frequency === "CUSTOM" ? (
                <FormItem label="Cada cuántos días" htmlFor="recurring-interval" error={errors.customIntervalDays}>
                  <Input id="recurring-interval" type="number" inputMode="numeric" min={1} max={365} aria-invalid={Boolean(errors.customIntervalDays)} {...form.register("customIntervalDays")} />
                </FormItem>
              ) : null}
              <FormItem label="Próximo pago" htmlFor="recurring-next" error={errors.nextDueDate}>
                <Input id="recurring-next" type="date" aria-invalid={Boolean(errors.nextDueDate)} {...form.register("nextDueDate")} />
              </FormItem>
              <FormItem label="Método de pago" htmlFor="recurring-method" error={errors.paymentMethod}>
                <Controller
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="recurring-method" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRING_PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {RECURRING_PAYMENT_METHOD_LABELS[method]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormItem>
              {paymentMethod === "CREDIT_CARD" ? (
                <FormItem
                  label="Tarjeta"
                  htmlFor="recurring-card"
                  error={errors.creditCardId}
                  description={cards.length === 0 ? "Registra una tarjeta en Finanzas → Tarjetas primero." : "Al marcarlo pagado se cargará a esta tarjeta, no a tu caja."}
                >
                  <Controller
                    control={form.control}
                    name="creditCardId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={cards.length === 0}>
                        <SelectTrigger id="recurring-card" className="w-full" aria-invalid={Boolean(errors.creditCardId)}>
                          <SelectValue placeholder="Elige la tarjeta" />
                        </SelectTrigger>
                        <SelectContent>
                          {cards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                              {card.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormItem>
              ) : null}
              <FormItem label="Avisar (días antes)" htmlFor="recurring-reminder" error={errors.reminderDays}>
                <Input id="recurring-reminder" type="number" inputMode="numeric" min={0} max={60} aria-invalid={Boolean(errors.reminderDays)} {...form.register("reminderDays")} />
              </FormItem>
            </div>

            <FormItem label="Notas" htmlFor="recurring-notes" error={errors.notes}>
              <Textarea id="recurring-notes" rows={2} {...form.register("notes")} />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="recurring-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            {isEdit ? "Guardar cambios" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
