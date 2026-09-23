"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRight } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { formatMoney } from "@/lib/format";
import { handleActionFailure } from "@/lib/forms";
import { type ReassignLoanInput, reassignLoanSchema } from "@/lib/validations/cash-box";
import { reassignLoanCashBoxAction } from "@/server/actions/loans";
import type { CashBoxOption } from "@/server/queries/cash-boxes";
import type { LoanSummaryDto } from "@/server/queries/loan-dto";

type LoanCashBoxDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanSummaryDto;
  options: CashBoxOption[];
};

/** Moves a loan to another fund; the old box gets back what it actually put in. */
export function LoanCashBoxDialog({ open, onOpenChange, loan, options }: LoanCashBoxDialogProps) {
  const [isPending, startTransition] = useTransition();
  const pendingNet = loan.principalAmount - loan.totalPaid;

  const form = useForm<{ cashBoxId: string }, unknown, ReassignLoanInput>({
    resolver: zodResolver(reassignLoanSchema) as Resolver<{ cashBoxId: string }, unknown, ReassignLoanInput>,
    defaultValues: { cashBoxId: "" },
  });

  useEffect(() => {
    if (open) form.reset({ cashBoxId: "" });
  }, [open, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await reassignLoanCashBoxAction(loan.id, values);
      if (handleActionFailure(form, result)) return;
      toast.success(`Préstamo movido de ${result.data.fromName} a ${result.data.toName}`);
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar caja</DialogTitle>
          <DialogDescription>
            {loan.cashBoxName
              ? `El préstamo pertenece a ${loan.cashBoxName}. Se le devolverán ${formatMoney(pendingNet)} (capital menos lo ya pagado) y la caja nueva asumirá ese monto.`
              : "Elige la caja de la que salió este préstamo."}
          </DialogDescription>
        </DialogHeader>
        <form id="loan-cash-box-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormItem label="Nueva caja" htmlFor="loan-new-cash-box" error={errors.cashBoxId}>
              <Controller
                control={form.control}
                name="cashBoxId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="loan-new-cash-box" className="w-full" aria-invalid={Boolean(errors.cashBoxId)}>
                      <SelectValue placeholder="Selecciona la caja" />
                    </SelectTrigger>
                    <SelectContent>
                      {options
                        .filter((option) => option.id !== loan.cashBoxId)
                        .map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name} — {formatMoney(option.available)} disponibles
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="loan-cash-box-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            Mover préstamo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LoanCashBoxButton({ loan, options }: { loan: LoanSummaryDto; options: CashBoxOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ArrowLeftRight aria-hidden="true" />
        Cambiar caja
      </Button>
      <LoanCashBoxDialog open={open} onOpenChange={setOpen} loan={loan} options={options} />
    </>
  );
}
