import { z } from "zod";

import { idSchema, isoDateSchema, moneySchema, optionalIsoDateSchema, optionalTrimmed } from "./common";

export const INSTALLMENT_FREQUENCIES = ["MONTHLY", "BIWEEKLY", "WEEKLY", "CUSTOM"] as const;
export const INTEREST_TYPES = ["SIMPLE"] as const;
export const LOAN_STATUSES = ["ACTIVE", "PAID", "OVERDUE", "CANCELLED"] as const;

export const loanSchema = z
  .object({
    personId: idSchema,
    principalAmount: moneySchema,
    monthlyInterestRate: z.coerce
      .number({ error: "Tasa requerida" })
      .min(0, { error: "La tasa no puede ser negativa" })
      .max(100, { error: "La tasa no puede superar 100 %" }),
    interestType: z.enum(INTEREST_TYPES).default("SIMPLE"),
    numberOfInstallments: z.coerce
      .number({ error: "Número de cuotas requerido" })
      .int({ error: "Debe ser un número entero" })
      .min(1, { error: "Mínimo 1 cuota" })
      .max(120, { error: "Máximo 120 cuotas" }),
    installmentFrequency: z.enum(INSTALLMENT_FREQUENCIES, { error: "Frecuencia inválida" }),
    // Hidden unless the frequency is CUSTOM, so an empty input must read as "not set".
    customIntervalDays: z
      .preprocess(
        (value) => (value === "" || value === undefined ? null : value),
        z.coerce
          .number()
          .int({ error: "Debe ser un número entero" })
          .min(1, { error: "Mínimo 1 día" })
          .max(365, { error: "Máximo 365 días" })
          .nullable(),
      )
      .optional(),
    startDate: isoDateSchema,
    dueDate: optionalIsoDateSchema,
    notes: optionalTrimmed(1000),
  })
  .superRefine((loan, ctx) => {
    if (loan.installmentFrequency === "CUSTOM" && !loan.customIntervalDays) {
      ctx.addIssue({
        code: "custom",
        path: ["customIntervalDays"],
        message: "Indica cada cuántos días vence una cuota",
      });
    }
    if (loan.dueDate && loan.dueDate < loan.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "El vencimiento no puede ser anterior al inicio",
      });
    }
  });

export type LoanInput = z.infer<typeof loanSchema>;
export type LoanFormValues = z.input<typeof loanSchema>;

export const loanStatusFilterSchema = z.enum([...LOAN_STATUSES, "ALL"]).catch("ALL");
