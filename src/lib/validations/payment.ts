import { z } from "zod";

import { idSchema, isoDateSchema, moneySchema, optionalTrimmed } from "./common";

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "OTHER"] as const;

/**
 * AUTO: installment by installment, interest first then principal.
 * INTEREST_ONLY: covers pending interest only; principal untouched.
 * PRINCIPAL: extraordinary principal payment; remaining installments are recalculated.
 */
export const PAYMENT_KINDS = ["AUTO", "INTEREST_ONLY", "PRINCIPAL"] as const;

export const paymentSchema = z
  .object({
    loanId: idSchema,
    installmentId: z
      .string()
      .trim()
      .nullish()
      .transform((v) => (v ? v : null)),
    kind: z.enum(PAYMENT_KINDS, { error: "Tipo de pago inválido" }).default("AUTO"),
    amount: moneySchema,
    paymentDate: isoDateSchema,
    paymentMethod: z.enum(PAYMENT_METHODS, { error: "Método de pago inválido" }),
    notes: optionalTrimmed(500),
  })
  .transform((payment) => ({
    ...payment,
    // A principal prepayment applies to the whole remaining balance, never to one installment.
    installmentId: payment.kind === "PRINCIPAL" ? null : payment.installmentId,
  }));

export type PaymentInput = z.infer<typeof paymentSchema>;
export type PaymentFormValues = z.input<typeof paymentSchema>;
