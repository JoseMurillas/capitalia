import { z } from "zod";

import { isoDateSchema, moneySchema, optionalTrimmed, reminderDaysSchema } from "./common";
import { EXPENSE_CATEGORIES } from "./transaction";

export const RECURRING_FREQUENCIES = [
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "CUSTOM",
] as const;
export const RECURRING_PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CREDIT_CARD", "OTHER"] as const;
export const RECURRING_STATUS_FILTERS = ["active", "paused", "all"] as const;

export type RecurringPaymentMethodValue = (typeof RECURRING_PAYMENT_METHODS)[number];
export type RecurringStatusFilter = (typeof RECURRING_STATUS_FILTERS)[number];

export const recurringExpenseSchema = z
  .object({
    name: z.string().trim().min(2, { error: "Escribe el nombre del gasto" }).max(100),
    category: z.enum(EXPENSE_CATEGORIES, { error: "Categoría inválida" }),
    amount: moneySchema,
    isVariable: z.boolean(),
    frequency: z.enum(RECURRING_FREQUENCIES, { error: "Frecuencia inválida" }),
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
    nextDueDate: isoDateSchema,
    paymentMethod: z.enum(RECURRING_PAYMENT_METHODS, { error: "Método inválido" }),
    // Hidden unless the method is CREDIT_CARD.
    creditCardId: z
      .preprocess((value) => (value === "" || value === undefined ? null : value), z.string().trim().min(1).nullable())
      .optional(),
    reminderDays: reminderDaysSchema,
    notes: optionalTrimmed(1000),
  })
  .superRefine((expense, ctx) => {
    if (expense.frequency === "CUSTOM" && !expense.customIntervalDays) {
      ctx.addIssue({ code: "custom", path: ["customIntervalDays"], message: "Indica cada cuántos días se paga" });
    }
    if (expense.paymentMethod === "CREDIT_CARD" && !expense.creditCardId) {
      ctx.addIssue({ code: "custom", path: ["creditCardId"], message: "Elige la tarjeta con la que se paga" });
    }
  });

export type RecurringExpenseInput = z.infer<typeof recurringExpenseSchema>;

export const markRecurringPaidSchema = z.object({
  amount: moneySchema,
  paidDate: isoDateSchema,
});

export type MarkRecurringPaidInput = z.infer<typeof markRecurringPaidSchema>;
