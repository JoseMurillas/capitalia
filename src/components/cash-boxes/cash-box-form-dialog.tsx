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
import { handleActionFailure } from "@/lib/forms";
import { type CreateCashBoxInput, createCashBoxSchema } from "@/lib/validations/cash-box";
import { createCashBoxAction, updateCashBoxAction } from "@/server/actions/cash-boxes";
import type { CashBoxDto } from "@/server/queries/cash-boxes";
import type { ActionResult } from "@/types";

type CashBoxFormValues = {
  name: string;
  description: string;
  openingBalance: number | "";
};

type CashBoxFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing box; otherwise a new one is created. */
  box?: CashBoxDto | null;
};

function toFormValues(box: CashBoxDto | null | undefined): CashBoxFormValues {
  return { name: box?.name ?? "", description: box?.description ?? "", openingBalance: box ? 0 : "" };
}

export function CashBoxFormDialog({ open, onOpenChange, box }: CashBoxFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(box);

  const form = useForm<CashBoxFormValues, unknown, CreateCashBoxInput>({
    resolver: zodResolver(createCashBoxSchema) as Resolver<CashBoxFormValues, unknown, CreateCashBoxInput>,
    defaultValues: toFormValues(box),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(box));
  }, [open, box, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      // Editing never touches the ledger: the opening balance is a create-only field.
      const result: ActionResult<unknown> = box
        ? await updateCashBoxAction(box.id, { name: values.name, description: values.description })
        : await createCashBoxAction(values);
      if (handleActionFailure(form, result)) return;
      toast.success(isEdit ? "Caja actualizada" : "Caja creada");
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar caja" : "Nueva caja"}</DialogTitle>
          <DialogDescription>
            Un fondo con su propio capital. Cada préstamo, retiro o traslado queda registrado en su historial.
          </DialogDescription>
        </DialogHeader>
        <form id="cash-box-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormItem label="Nombre" htmlFor="cash-box-name" error={errors.name}>
              <Input id="cash-box-name" placeholder="José Murillas" autoFocus aria-invalid={Boolean(errors.name)} {...form.register("name")} />
            </FormItem>
            {isEdit ? null : (
              <FormItem
                label="Capital inicial"
                htmlFor="cash-box-opening"
                error={errors.openingBalance}
                description="Cuánto dinero tiene la caja hoy. Puedes dejar 0 y depositar después."
              >
                <Input
                  id="cash-box-opening"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  aria-invalid={Boolean(errors.openingBalance)}
                  {...form.register("openingBalance")}
                />
              </FormItem>
            )}
            <FormItem label="Descripción" htmlFor="cash-box-description" error={errors.description}>
              <Textarea id="cash-box-description" rows={2} {...form.register("description")} />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="cash-box-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            {isEdit ? "Guardar cambios" : "Crear caja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
