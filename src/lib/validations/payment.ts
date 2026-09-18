import { z } from "zod";

import { idSchema, isoDateSchema, moneySchema, optionalTrimmed } from "./common";

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "OTHER"] as const;

export const paymentSchema = z.object({
  loanId: idSchema,
  installmentId: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null)),
  amount: moneySchema,
  paymentDate: isoDateSchema,
  paymentMethod: z.enum(PAYMENT_METHODS, { error: "Método de pago inválido" }),
  notes: optionalTrimmed(500),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
export type PaymentFormValues = z.input<typeof paymentSchema>;
