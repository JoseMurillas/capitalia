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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { guessCategory } from "@/lib/categorize";
import { handleActionFailure } from "@/lib/forms";
import { TRANSACTION_CATEGORY_LABELS } from "@/lib/labels";
import {
  categoriesForType,
  type TransactionCategoryValue,
  type TransactionInput,
  transactionSchema,
} from "@/lib/validations/transaction";
import { confirmInboxMessageAction } from "@/server/actions/inbox";
import type { InboxMessageDto } from "@/server/queries/inbox";

type FormValues = {
  type: "INCOME" | "EXPENSE";
  category: TransactionCategoryValue | "";
  amount: number | "";
  description: string;
  transactionDate: string;
  notes: string;
};

type ConfirmInboxDialogProps = {
  message: InboxMessageDto | null;
  onOpenChange: (open: boolean) => void;
};

function toValues(message: InboxMessageDto | null): FormValues {
  const type = message?.direction === "INCOME" ? "INCOME" : "EXPENSE";
  return {
    type,
    category: message?.suggestedCategory ?? "",
    amount: message?.amount ?? "",
    description: message?.description ?? "",
    transactionDate: message?.suggestedDate ?? "",
    notes: message?.subject ? `Correo: ${message.subject}`.slice(0, 200) : "",
  };
}

export function ConfirmInboxDialog({ message, onOpenChange }: ConfirmInboxDialogProps) {
  const [isPending, startTransition] = useTransition();
  const open = message !== null;

  const form = useForm<FormValues, unknown, TransactionInput>({
    resolver: zodResolver(transactionSchema) as Resolver<FormValues, unknown, TransactionInput>,
    defaultValues: toValues(message),
  });
  const type = useWatch({ control: form.control, name: "type" });

  useEffect(() => {
    if (message) form.reset(toValues(message));
  }, [message, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (!message) return;
    startTransition(async () => {
      const result = await confirmInboxMessageAction({ messageId: message.id, transaction: values });
      if (handleActionFailure(form, result)) return;
      toast.success(values.type === "INCOME" ? "Ingreso registrado" : "Gasto registrado");
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar movimiento</DialogTitle>
          <DialogDescription>Revisa lo que detectamos en el correo y ajusta lo que haga falta.</DialogDescription>
        </DialogHeader>
        <form id="confirm-inbox-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Tabs
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("category", guessCategory(value as FormValues["type"], form.getValues("description")));
                  }}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="INCOME" className="flex-1">
                      Ingreso
                    </TabsTrigger>
                    <TabsTrigger value="EXPENSE" className="flex-1">
                      Gasto
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem label="Monto" htmlFor="inbox-amount" error={errors.amount}>
                <Input id="inbox-amount" type="number" inputMode="decimal" min={1} step="1" aria-invalid={Boolean(errors.amount)} {...form.register("amount")} />
              </FormItem>
              <FormItem label="Fecha" htmlFor="inbox-date" error={errors.transactionDate}>
                <Input id="inbox-date" type="date" aria-invalid={Boolean(errors.transactionDate)} {...form.register("transactionDate")} />
              </FormItem>
            </div>
            <FormItem label="Categoría" htmlFor="inbox-category" error={errors.category}>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="inbox-category" className="w-full" aria-invalid={Boolean(errors.category)}>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesForType(type).map((category) => (
                        <SelectItem key={category} value={category}>
                          {TRANSACTION_CATEGORY_LABELS[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormItem>
            <FormItem label="Descripción" htmlFor="inbox-description" error={errors.description}>
              <Input id="inbox-description" aria-invalid={Boolean(errors.description)} {...form.register("description")} />
            </FormItem>
            <FormItem label="Notas" htmlFor="inbox-notes" error={errors.notes}>
              <Input id="inbox-notes" {...form.register("notes")} />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="confirm-inbox-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            Guardar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
