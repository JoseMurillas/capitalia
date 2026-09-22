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
import { todayIso } from "@/lib/dates";
import { handleActionFailure } from "@/lib/forms";
import { type InstallmentPlanInput, installmentPlanSchema } from "@/lib/validations/credit-card";
import { createInstallmentPlanAction, updateInstallmentPlanAction } from "@/server/actions/credit-cards";
import type { InstallmentPlanDto } from "@/server/queries/credit-cards";
import type { ActionResult } from "@/types";

type PlanFormValues = {
  description: string;
  totalAmount: number | "";
  installmentAmount: number | "";
  installments: number | "";
  paidInstallments: number | "";
  startDate: string;
  notes: string;
};

type InstallmentPlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  plan?: InstallmentPlanDto | null;
};

function toFormValues(plan: InstallmentPlanDto | null | undefined): PlanFormValues {
  return {
    description: plan?.description ?? "",
    totalAmount: plan?.totalAmount ?? "",
    installmentAmount: plan?.installmentAmount ?? "",
    installments: plan?.installments ?? "",
    paidInstallments: plan?.paidInstallments ?? 0,
    startDate: plan?.startDate ?? todayIso(),
    notes: plan?.notes ?? "",
  };
}

export function InstallmentPlanDialog({ open, onOpenChange, cardId, plan }: InstallmentPlanDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(plan);

  const form = useForm<PlanFormValues, unknown, InstallmentPlanInput>({
    resolver: zodResolver(installmentPlanSchema) as Resolver<PlanFormValues, unknown, InstallmentPlanInput>,
    defaultValues: toFormValues(plan),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(plan));
  }, [open, plan, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result: ActionResult<unknown> = plan
        ? await updateInstallmentPlanAction(cardId, plan.id, values)
        : await createInstallmentPlanAction(cardId, values);
      if (handleActionFailure(form, result)) return;
      toast.success(isEdit ? "Compra actualizada" : "Compra diferida registrada");
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar compra diferida" : "Nueva compra diferida"}</DialogTitle>
          <DialogDescription>
            Compras a cuotas. Sirven para explicar el pago del mes; no cambian el saldo por sí solas.
          </DialogDescription>
        </DialogHeader>
        <form id="installment-plan-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormItem label="Descripción" htmlFor="plan-description" error={errors.description}>
              <Input id="plan-description" placeholder="Televisor, tiquetes…" autoFocus aria-invalid={Boolean(errors.description)} {...form.register("description")} />
            </FormItem>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem label="Valor total" htmlFor="plan-total" error={errors.totalAmount}>
                <Input id="plan-total" type="number" inputMode="decimal" min={1} step="1" {...form.register("totalAmount")} />
              </FormItem>
              <FormItem label="Valor de cada cuota" htmlFor="plan-installment" error={errors.installmentAmount} description="Como aparece en el extracto (incluye intereses)">
                <Input id="plan-installment" type="number" inputMode="decimal" min={1} step="1" {...form.register("installmentAmount")} />
              </FormItem>
              <FormItem label="Número de cuotas" htmlFor="plan-installments" error={errors.installments}>
                <Input id="plan-installments" type="number" inputMode="numeric" min={1} max={120} {...form.register("installments")} />
              </FormItem>
              <FormItem label="Cuotas ya pagadas" htmlFor="plan-paid" error={errors.paidInstallments}>
                <Input id="plan-paid" type="number" inputMode="numeric" min={0} max={120} {...form.register("paidInstallments")} />
              </FormItem>
              <FormItem label="Fecha de compra" htmlFor="plan-start" error={errors.startDate}>
                <Input id="plan-start" type="date" {...form.register("startDate")} />
              </FormItem>
            </div>
            <FormItem label="Notas" htmlFor="plan-notes" error={errors.notes}>
              <Textarea id="plan-notes" rows={2} {...form.register("notes")} />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="installment-plan-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            {isEdit ? "Guardar cambios" : "Registrar compra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
