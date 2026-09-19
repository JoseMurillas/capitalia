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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { formatDate, todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { handleActionFailure } from "@/lib/forms";
import { PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import {
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  type PaymentInput,
  paymentSchema,
} from "@/lib/validations/payment";
import { registerPaymentAction } from "@/server/actions/payments";
import type { InstallmentDto } from "@/server/queries/loan-dto";

export type PaymentDialogLoan = {
  id: string;
  personName: string;
  balance: number;
  installments: InstallmentDto[];
};

type PaymentKind = (typeof PAYMENT_KINDS)[number];

type PaymentFormValues = {
  loanId: string;
  installmentId: string;
  kind: PaymentKind;
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

const AUTO_INSTALLMENT = "auto";

const KIND_HELP: Record<PaymentKind, string> = {
  AUTO: "Cuota por cuota: primero cubre el interés pendiente y luego el capital; el sobrante pasa a la siguiente cuota.",
  INTEREST_ONLY: "Solo cubre intereses pendientes (de la cuota más antigua en adelante). El capital queda igual.",
  PRINCIPAL:
    "Reduce el capital pendiente. Las cuotas restantes se recalculan sobre el nuevo saldo, así que el interés baja de ahí en adelante.",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function makeDefaults(loanId: string): PaymentFormValues {
  return {
    loanId,
    installmentId: AUTO_INSTALLMENT,
    kind: "AUTO",
    amount: "",
    paymentDate: todayIso(),
    paymentMethod: "CASH",
    notes: "",
  };
}

export function PaymentDialog({ open, onOpenChange, loans, defaultLoanId }: PaymentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const lockedLoan = loans.length === 1 ? loans[0] : null;
  const initialLoanId = lockedLoan?.id ?? defaultLoanId ?? "";

  const form = useForm<PaymentFormValues, unknown, PaymentInput>({
    resolver: zodResolver(paymentSchema) as Resolver<PaymentFormValues, unknown, PaymentInput>,
    defaultValues: makeDefaults(initialLoanId),
  });

  const [loanId, installmentId, kind] = useWatch({
    control: form.control,
    name: ["loanId", "installmentId", "kind"],
  });

  const loan = useMemo(() => loans.find((l) => l.id === loanId) ?? null, [loans, loanId]);
  const pendingInstallments = useMemo(
    () => loan?.installments.filter((i) => i.status !== "PAID") ?? [],
    [loan],
  );

  // Display-only figures; the server recomputes everything from the database.
  const pendingInterest = round2(
    pendingInstallments.reduce((acc, i) => acc + Math.max(0, i.interestAmount - i.interestPaid), 0),
  );
  const pendingPrincipal = round2(
    pendingInstallments.reduce((acc, i) => acc + Math.max(0, i.principalAmount - i.principalPaid), 0),
  );

  const targetInstallment =
    installmentId !== AUTO_INSTALLMENT
      ? (pendingInstallments.find((i) => i.id === installmentId) ?? null)
      : (pendingInstallments[0] ?? null);

  const suggestedAmount = (() => {
    if (!targetInstallment) return 0;
    switch (kind) {
      case "AUTO":
        return targetInstallment.pendingAmount;
      case "INTEREST_ONLY":
        return round2(Math.max(0, targetInstallment.interestAmount - targetInstallment.interestPaid));
      case "PRINCIPAL":
        return pendingPrincipal;
    }
  })();

  useEffect(() => {
    if (open) form.reset(makeDefaults(initialLoanId));
  }, [open, form, initialLoanId]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await registerPaymentAction({
        ...values,
        installmentId: values.installmentId === AUTO_INSTALLMENT ? null : values.installmentId,
      });
      if (handleActionFailure(form, result)) return;

      const { interestPaid, principalPaid, loanStatus } = result.data;
      const detail =
        values.kind === "PRINCIPAL"
          ? `${formatMoney(principalPaid)} abonados a capital; las cuotas restantes se recalcularon.`
          : `${formatMoney(interestPaid)} a intereses y ${formatMoney(principalPaid)} a capital.`;
      toast.success("Pago registrado", {
        description: `${detail}${loanStatus === "PAID" ? " El préstamo quedó pagado." : ""}`,
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
          <DialogDescription>Elige a qué se aplica el dinero: cuota, solo intereses o capital.</DialogDescription>
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
                      form.setValue("installmentId", AUTO_INSTALLMENT);
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
              <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Saldo total</dt>
                  <dd className="font-medium">
                    <MoneyDisplay value={loan.balance} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Intereses pend.</dt>
                  <dd className="font-medium">
                    <MoneyDisplay value={pendingInterest} tone="positive" />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Capital pend.</dt>
                  <dd className="font-medium">
                    <MoneyDisplay value={pendingPrincipal} />
                  </dd>
                </div>
              </dl>
            ) : null}

            <Field>
              <FieldLabel htmlFor="payment-kind">Aplicar a</FieldLabel>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Tabs
                    id="payment-kind"
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("installmentId", AUTO_INSTALLMENT);
                      form.setValue("amount", "");
                    }}
                  >
                    <TabsList className="w-full">
                      {PAYMENT_KINDS.map((option) => (
                        <TabsTrigger key={option} value={option} className="flex-1">
                          {option === "AUTO" ? "Cuota" : PAYMENT_KIND_LABELS[option]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}
              />
              <FieldDescription>{KIND_HELP[kind]}</FieldDescription>
            </Field>

            {kind !== "PRINCIPAL" ? (
              <FormItem
                label="Cuota"
                htmlFor="payment-installment"
                error={errors.installmentId}
                description="Automática empieza por la cuota más antigua pendiente."
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
                        <SelectItem value={AUTO_INSTALLMENT}>Automática (orden de vencimiento)</SelectItem>
                        {pendingInstallments.map((installment) => (
                          <SelectItem key={installment.id} value={installment.id}>
                            <span className="flex items-center gap-2">
                              #{installment.installmentNumber} · {formatDate(installment.dueDate)} ·{" "}
                              {formatMoney(
                                kind === "INTEREST_ONLY"
                                  ? Math.max(0, installment.interestAmount - installment.interestPaid)
                                  : installment.pendingAmount,
                              )}
                              <InstallmentStatusBadge status={installment.status} />
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormItem>
            ) : null}

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
                      {kind === "PRINCIPAL"
                        ? `Usar todo el capital (${formatMoney(suggestedAmount)})`
                        : `Usar ${formatMoney(suggestedAmount)}`}
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
            {kind === "PRINCIPAL" ? "Registrar abono" : "Registrar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
