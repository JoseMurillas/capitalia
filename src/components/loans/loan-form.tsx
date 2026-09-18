"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FormItem } from "@/components/shared/form-item";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { handleActionFailure } from "@/lib/forms";
import { FREQUENCY_LABELS, INTEREST_TYPE_LABELS } from "@/lib/labels";
import {
  INSTALLMENT_FREQUENCIES,
  INTEREST_TYPES,
  type LoanInput,
  loanSchema,
} from "@/lib/validations/loan";
import { createLoanAction, previewScheduleAction, type SchedulePreview as SchedulePreviewData } from "@/server/actions/loans";
import type { PersonOption } from "@/server/queries/people";

import { SchedulePreview } from "./schedule-preview";

type LoanFormValues = {
  personId: string;
  principalAmount: number | "";
  monthlyInterestRate: number | "";
  interestType: (typeof INTEREST_TYPES)[number];
  numberOfInstallments: number | "";
  installmentFrequency: (typeof INSTALLMENT_FREQUENCIES)[number];
  customIntervalDays: number | "";
  startDate: string;
  dueDate: string;
  notes: string;
};

type LoanFormProps = {
  people: PersonOption[];
  defaultPersonId?: string;
};

const PREVIEW_DEBOUNCE_MS = 350;

export function LoanForm({ people, defaultPersonId }: LoanFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [previewState, setPreviewState] = useState<{
    key: string;
    data: SchedulePreviewData | null;
  } | null>(null);

  const form = useForm<LoanFormValues, unknown, LoanInput>({
    // The schema coerces numeric strings; the cast reconciles its input type with the form values.
    resolver: zodResolver(loanSchema) as Resolver<LoanFormValues, unknown, LoanInput>,
    defaultValues: {
      personId: defaultPersonId && people.some((p) => p.id === defaultPersonId) ? defaultPersonId : "",
      principalAmount: "",
      monthlyInterestRate: "",
      interestType: "SIMPLE",
      numberOfInstallments: 1,
      installmentFrequency: "MONTHLY",
      customIntervalDays: "",
      startDate: todayIso(),
      dueDate: "",
      notes: "",
    },
  });

  const [
    principalAmount,
    monthlyInterestRate,
    interestType,
    numberOfInstallments,
    frequency,
    customIntervalDays,
    startDate,
  ] = useWatch({
    control: form.control,
    name: [
      "principalAmount",
      "monthlyInterestRate",
      "interestType",
      "numberOfInstallments",
      "installmentFrequency",
      "customIntervalDays",
      "startDate",
    ],
  });

  const previewInput = useMemo(
    () => ({
      personId: "preview",
      principalAmount,
      monthlyInterestRate,
      interestType,
      numberOfInstallments,
      installmentFrequency: frequency,
      customIntervalDays: frequency === "CUSTOM" ? customIntervalDays : null,
      startDate,
      notes: "",
    }),
    [principalAmount, monthlyInterestRate, interestType, numberOfInstallments, frequency, customIntervalDays, startDate],
  );

  const previewReady =
    Number(principalAmount) > 0 &&
    monthlyInterestRate !== "" &&
    Number(numberOfInstallments) >= 1 &&
    Boolean(startDate) &&
    (frequency !== "CUSTOM" || Number(customIntervalDays) >= 1);
  const previewKey = previewReady ? JSON.stringify(previewInput) : null;

  useEffect(() => {
    if (!previewKey) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const result = await previewScheduleAction(previewInput);
      if (cancelled) return;
      setPreviewState({ key: previewKey, data: result.success ? result.data : null });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [previewKey, previewInput]);

  // Keep showing the last schedule while a newer one is being computed.
  const preview = previewKey && previewState ? previewState.data : null;
  const previewLoading = Boolean(previewKey) && previewState?.key !== previewKey;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await createLoanAction(values);
      if (handleActionFailure(form, result)) return;
      toast.success("Préstamo creado con su cronograma de cuotas");
      router.push(`/prestamos/${result.data.id}`);
    });
  });

  const { errors } = form.formState;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Datos del préstamo</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="loan-form" onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <FormItem label="Persona" htmlFor="loan-person" error={errors.personId}>
                <Controller
                  control={form.control}
                  name="personId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="loan-person" aria-invalid={Boolean(errors.personId)} className="w-full">
                        <SelectValue placeholder="Selecciona una persona" />
                      </SelectTrigger>
                      <SelectContent>
                        {people.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name}
                            {person.document ? ` · ${person.document}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormItem>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormItem label="Monto prestado" htmlFor="loan-principal" error={errors.principalAmount}>
                  <Input
                    id="loan-principal"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step="1"
                    placeholder="1000000"
                    aria-invalid={Boolean(errors.principalAmount)}
                    {...form.register("principalAmount")}
                  />
                </FormItem>
                <FormItem label="Interés mensual (%)" htmlFor="loan-rate" error={errors.monthlyInterestRate}>
                  <Input
                    id="loan-rate"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.1"
                    placeholder="12"
                    aria-invalid={Boolean(errors.monthlyInterestRate)}
                    {...form.register("monthlyInterestRate")}
                  />
                </FormItem>
              </div>

              <FormItem label="Tipo de interés" htmlFor="loan-interest-type" error={errors.interestType}>
                <Controller
                  control={form.control}
                  name="interestType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="loan-interest-type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTEREST_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {INTEREST_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormItem>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormItem label="Número de cuotas" htmlFor="loan-installments" error={errors.numberOfInstallments}>
                  <Input
                    id="loan-installments"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={120}
                    step="1"
                    aria-invalid={Boolean(errors.numberOfInstallments)}
                    {...form.register("numberOfInstallments")}
                  />
                </FormItem>
                <FormItem label="Frecuencia" htmlFor="loan-frequency" error={errors.installmentFrequency}>
                  <Controller
                    control={form.control}
                    name="installmentFrequency"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="loan-frequency" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INSTALLMENT_FREQUENCIES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {FREQUENCY_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormItem>
              </div>

              {frequency === "CUSTOM" ? (
                <FormItem
                  label="Días entre cuotas"
                  htmlFor="loan-interval"
                  error={errors.customIntervalDays}
                  description="El interés se prorratea sobre 30 días."
                >
                  <Input
                    id="loan-interval"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    step="1"
                    aria-invalid={Boolean(errors.customIntervalDays)}
                    {...form.register("customIntervalDays")}
                  />
                </FormItem>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormItem label="Fecha de inicio" htmlFor="loan-start" error={errors.startDate}>
                  <Input
                    id="loan-start"
                    type="date"
                    aria-invalid={Boolean(errors.startDate)}
                    {...form.register("startDate")}
                  />
                </FormItem>
                <FormItem
                  label="Fecha de vencimiento"
                  htmlFor="loan-due"
                  error={errors.dueDate}
                  description={
                    preview
                      ? `Si se deja vacía se usa la última cuota: ${formatDate(preview.dueDate)}.`
                      : "Opcional; por defecto es la fecha de la última cuota."
                  }
                >
                  <Input
                    id="loan-due"
                    type="date"
                    aria-invalid={Boolean(errors.dueDate)}
                    {...form.register("dueDate")}
                  />
                </FormItem>
              </div>

              <FormItem label="Notas" htmlFor="loan-notes" error={errors.notes}>
                <Textarea id="loan-notes" rows={3} placeholder="Destino del préstamo, acuerdos, garantías…" {...form.register("notes")} />
              </FormItem>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Spinner /> : null}
                  Crear préstamo
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <SchedulePreview preview={preview} loading={previewLoading} />
    </div>
  );
}
