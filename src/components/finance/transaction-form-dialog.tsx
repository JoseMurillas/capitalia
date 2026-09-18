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
import { Textarea } from "@/components/ui/textarea";
import { todayIso } from "@/lib/dates";
import { handleActionFailure } from "@/lib/forms";
import { TRANSACTION_CATEGORY_LABELS } from "@/lib/labels";
import {
  categoriesForType,
  type TransactionCategoryValue,
  type TransactionInput,
  transactionSchema,
} from "@/lib/validations/transaction";
import { createTransactionAction, updateTransactionAction } from "@/server/actions/transactions";
import type { TransactionDto } from "@/server/queries/transactions";
import type { ActionResult } from "@/types";

type TransactionFormValues = {
  type: "INCOME" | "EXPENSE";
  category: TransactionCategoryValue | "";
  amount: number | "";
  description: string;
  transactionDate: string;
  notes: string;
};

type TransactionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing movement; otherwise a new one of `defaultType` is created. */
  transaction?: TransactionDto | null;
  defaultType?: "INCOME" | "EXPENSE";
};

function toFormValues(transaction?: TransactionDto | null, defaultType: "INCOME" | "EXPENSE" = "EXPENSE"): TransactionFormValues {
  return {
    type: transaction?.type ?? defaultType,
    category: transaction?.category ?? "",
    amount: transaction?.amount ?? "",
    description: transaction?.description ?? "",
    transactionDate: transaction?.transactionDate ?? todayIso(),
    notes: transaction?.notes ?? "",
  };
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  defaultType = "EXPENSE",
}: TransactionFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(transaction);

  const form = useForm<TransactionFormValues, unknown, TransactionInput>({
    resolver: zodResolver(transactionSchema) as Resolver<TransactionFormValues, unknown, TransactionInput>,
    defaultValues: toFormValues(transaction, defaultType),
  });

  const type = useWatch({ control: form.control, name: "type" });
  const categories = categoriesForType(type);

  useEffect(() => {
    if (open) form.reset(toFormValues(transaction, defaultType));
  }, [open, transaction, defaultType, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result: ActionResult<unknown> = transaction
        ? await updateTransactionAction(transaction.id, values)
        : await createTransactionAction(values);
      if (handleActionFailure(form, result)) return;
      toast.success(isEdit ? "Movimiento actualizado" : values.type === "INCOME" ? "Ingreso registrado" : "Gasto registrado");
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
          <DialogDescription>Ingresos y gastos personales, independientes de los préstamos.</DialogDescription>
        </DialogHeader>
        <form id="transaction-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Tabs
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("category", "", { shouldValidate: false });
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
              <FormItem label="Monto" htmlFor="transaction-amount" error={errors.amount}>
                <Input
                  id="transaction-amount"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="1"
                  autoFocus
                  aria-invalid={Boolean(errors.amount)}
                  {...form.register("amount")}
                />
              </FormItem>
              <FormItem label="Fecha" htmlFor="transaction-date" error={errors.transactionDate}>
                <Input id="transaction-date" type="date" aria-invalid={Boolean(errors.transactionDate)} {...form.register("transactionDate")} />
              </FormItem>
            </div>

            <FormItem label="Categoría" htmlFor="transaction-category" error={errors.category}>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="transaction-category" className="w-full" aria-invalid={Boolean(errors.category)}>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {TRANSACTION_CATEGORY_LABELS[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormItem>

            <FormItem label="Descripción" htmlFor="transaction-description" error={errors.description}>
              <Input id="transaction-description" placeholder="Arriendo, salario, mercado…" aria-invalid={Boolean(errors.description)} {...form.register("description")} />
            </FormItem>

            <FormItem label="Notas" htmlFor="transaction-notes" error={errors.notes}>
              <Textarea id="transaction-notes" rows={2} {...form.register("notes")} />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="transaction-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            {isEdit ? "Guardar cambios" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
