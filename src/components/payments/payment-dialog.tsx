"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useTransition } from "react";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FormItem } from "@/components/shared/form-item";
import { MoneyDisplay } from "@/components/shared/money-display";
import { InstallmentStatusBadge } from "@/components/shared/status-badge";
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
import { Textarea } from "@/components/ui/textarea";
import { formatDate, todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { handleActionFailure } from "@/lib/forms";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { PAYMENT_METHODS, type PaymentInput, paymentSchema } from "@/lib/validations/payment";
import { registerPaymentAction } from "@/server/actions/payments";
import type { InstallmentDto } from "@/server/queries/loan-dto";

export type PaymentDialogLoan = {
  id: string;
  personName: string;
  balance: number;
  installments: InstallmentDto[];
};

type PaymentFormValues = {
  loanId: string;
  installmentId: string;
  amount: number | "";
  paymentDate: string;
  paymentMethod: (typeof PAYMENT_METHODS)[number];
  notes: string;
};

type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Loans the user can pick from; pass a single loan to lock the selection. */
  loans: PaymentDialogLoan[];
  defaultLoanId?: string;
};

const AUTO = "auto";

export function PaymentDialog({ open, onOpenChange, loans, defaultLoanId }: PaymentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const lockedLoan = loans.length === 1 ? loans[0] : null;

  const form = useForm<PaymentFormValues, unknown, PaymentInput>({
    resolver: zodResolver(paymentSchema) as Resolver<PaymentFormValues, unknown, PaymentInput>,
    defaultValues: {
      loanId: lockedLoan?.id ?? defaultLoanId ?? "",
      installmentId: AUTO,
      amount: "",
      paymentDate: todayIso(),
      paymentMethod: "CASH",
      notes: "",
    },
  });

  const loanId = useWatch({ control: form.control, name: "loanId" });
  const installmentId = useWatch({ control: form.control, name: "installmentId" });

  const loan = useMemo(() => loans.find((l) => l.id === loanId) ?? null, [loans, loanId]);
  const pendingInstallments = useMemo(
    () => loan?.installments.filter((i) => i.status !== "PAID") ?? [],
    [loan],
  );
  const selectedInstallment =
    installmentId !== AUTO ? pendingInstallments.find((i) => i.id === installmentId) ?? null : null;
  const suggestedAmount = selectedInstallment?.pendingAmount ?? pendingInstallments[0]?.pendingAmount ?? 0;

  useEffect(() => {
    if (open) {
      form.reset({
        loanId: lockedLoan?.id ?? defaultLoanId ?? "",
        installmentId: AUTO,
        amount: "",
        paymentDate: todayIso(),
        paymentMethod: "CASH",
        notes: "",
      });
    }
  }, [open, form, lockedLoan, defaultLoanId]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await registerPaymentAction({
        ...values,
        installmentId: values.installmentId === AUTO ? null : values.installmentId,
      });
      if (handleActionFailure(form, result)) return;

      const { interestPaid, principalPaid, loanStatus } = result.data;
      toast.success("Pago registrado", {
        description: `${formatMoney(interestPaid)} a intereses y ${formatMoney(principalPaid)} a capital${
          loanStatus === "PAID" ? ". El préstamo quedó pagado." : "."
        }`,
      });
      onOpenChange(false);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            El sistema aplica el monto primero a intereses pendientes y luego a capital.
          </DialogDescription>
        </DialogHeader>
        <form id="payment-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormItem label="Préstamo" htmlFor="payment-loan" error={errors.loanId}>
              <Controller
                control={form.control}
                name="loanId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("installmentId", AUTO);
                    }}
                    disabled={Boolean(lockedLoan)}
                  >
                    <SelectTrigger id="payment-loan" className="w-full" aria-invalid={Boolean(errors.loanId)}>
                      <SelectValue placeholder="Selecciona un préstamo" />
                    </SelectTrigger>
                    <SelectContent>
                      {loans.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.personName} · saldo {formatMoney(option.balance)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormItem>

            {loan ? (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Saldo pendiente</span>
                  <MoneyDisplay value={loan.balance} className="font-medium" />
                </div>
                {pendingInstallments[0] ? (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Próxima cuota #{pendingInstallments[0].installmentNumber} ·{" "}
                      {formatDate(pendingInstallments[0].dueDate)}
                    </span>
                    <MoneyDisplay value={pendingInstallments[0].pendingAmount} />
                  </div>
                ) : null}
              </div>
            ) : null}

            <FormItem
              label="Cuota"
              htmlFor="payment-installment"
              error={errors.installmentId}
              description="Automática aplica a la cuota más antigua pendiente y el sobrante a las siguientes."
            >
              <Controller
                control={form.control}
                name="installmentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!loan}>
                    <SelectTrigger id="payment-installment" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO}>Automática (orden de vencimiento)</SelectItem>
                      {pendingInstallments.map((installment) => (
                        <SelectItem key={installment.id} value={installment.id}>
                          <span className="flex items-center gap-2">
                            #{installment.installmentNumber} · {formatDate(installment.dueDate)} ·{" "}
                            {formatMoney(installment.pendingAmount)}
                            <InstallmentStatusBadge status={installment.status} />
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormItem>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem
                label="Monto"
                htmlFor="payment-amount"
                error={errors.amount}
                description={
                  suggestedAmount > 0 ? (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => form.setValue("amount", suggestedAmount, { shouldValidate: true })}
                    >
                      Usar {formatMoney(suggestedAmount)}
                    </button>
                  ) : null
                }
              >
                <Input
                  id="payment-amount"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="1"
                  aria-invalid={Boolean(errors.amount)}
                  {...form.register("amount")}
                />
              </FormItem>
              <FormItem label="Fecha" htmlFor="payment-date" error={errors.paymentDate}>
                <Input id="payment-date" type="date" aria-invalid={Boolean(errors.paymentDate)} {...form.register("paymentDate")} />
              </FormItem>
            </div>

            <FormItem label="Método de pago" htmlFor="payment-method" error={errors.paymentMethod}>
              <Controller
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="payment-method" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {PAYMENT_METHOD_LABELS[method]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormItem>

            <FormItem label="Notas" htmlFor="payment-notes" error={errors.notes}>
              <Textarea id="payment-notes" rows={2} {...form.register("notes")} />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="payment-form" disabled={isPending || !loan}>
            {isPending ? <Spinner /> : null}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
