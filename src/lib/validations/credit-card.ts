import { z } from "zod";

import {
  isoDateSchema,
  moneySchema,
  nonNegativeMoneySchema,
  optionalMoneySchema,
  optionalTrimmed,
  reminderDaysSchema,
} from "./common";

export const creditCardSchema = z.object({
  name: z.string().trim().min(2, { error: "Escribe el nombre o banco de la tarjeta" }).max(100),
  creditLimit: moneySchema,
  /** Outstanding balance from the latest statement; zero for a brand-new card. */
  balance: nonNegativeMoneySchema,
  minimumPayment: optionalMoneySchema,
  paymentAmount: optionalMoneySchema,
  nextClosingDate: isoDateSchema,
  nextPaymentDate: isoDateSchema,
  reminderDays: reminderDaysSchema,
  notes: optionalTrimmed(1000),
});

export type CreditCardInput = z.infer<typeof creditCardSchema>;
export type CreditCardFormValues = z.input<typeof creditCardSchema>;

/** Fields the user updates when a new statement arrives. */
export const creditCardStatementSchema = creditCardSchema.pick({
  balance: true,
  minimumPayment: true,
  paymentAmount: true,
  nextClosingDate: true,
  nextPaymentDate: true,
});

export type CreditCardStatementInput = z.infer<typeof creditCardStatementSchema>;

export const creditCardPaymentSchema = z.object({
  amount: moneySchema,
  paidDate: isoDateSchema,
  notes: optionalTrimmed(500),
  /** Move closing/payment dates one month ahead and count one installment on every active plan. */
  advanceCycle: z.boolean(),
});

export type CreditCardPaymentInput = z.infer<typeof creditCardPaymentSchema>;

export const installmentPlanSchema = z
  .object({
    description: z.string().trim().min(2, { error: "Describe la compra" }).max(120),
    totalAmount: moneySchema,
    installmentAmount: moneySchema,
    installments: z.coerce
      .number({ error: "Número de cuotas requerido" })
      .int({ error: "Debe ser un número entero" })
      .min(1, { error: "Mínimo 1 cuota" })
      .max(120, { error: "Máximo 120 cuotas" }),
    paidInstallments: z.coerce
      .number({ error: "Indica cuántas cuotas van pagadas" })
      .int({ error: "Debe ser un número entero" })
      .min(0, { error: "No puede ser negativo" })
      .max(120),
    startDate: isoDateSchema,
    notes: optionalTrimmed(500),
  })
  .refine((plan) => plan.paidInstallments <= plan.installments, {
    error: "No puede haber más cuotas pagadas que cuotas en total",
    path: ["paidInstallments"],
  });

export type InstallmentPlanInput = z.infer<typeof installmentPlanSchema>;
