import { z } from "zod";

import {
  idSchema,
  isoDateSchema,
  moneySchema,
  nonNegativeMoneySchema,
  optionalTrimmed,
  signedMoneySchema,
} from "./common";

export const CASH_BOX_COUNTERPARTIES = ["PERSONAL_FINANCES", "EXTERNAL"] as const;
export type CashBoxCounterpartyValue = (typeof CASH_BOX_COUNTERPARTIES)[number];

/** Every movement kind, in ledger order; used by the history filter. */
export const CASH_BOX_MOVEMENT_KINDS = [
  "OPENING",
  "DEPOSIT",
  "WITHDRAWAL",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "LOAN_DISBURSEMENT",
  "LOAN_PAYMENT",
  "LOAN_REVERSAL",
  "LOAN_REASSIGNMENT",
  "ADJUSTMENT",
] as const;
export type CashBoxMovementKindValue = (typeof CASH_BOX_MOVEMENT_KINDS)[number];

export const cashBoxSchema = z.object({
  name: z.string().trim().min(2, { error: "Escribe el nombre de la caja" }).max(60),
  description: optionalTrimmed(300),
});

export type CashBoxInput = z.infer<typeof cashBoxSchema>;

/** Creating a box also opens its ledger with the capital it starts with. */
export const createCashBoxSchema = cashBoxSchema.extend({
  openingBalance: nonNegativeMoneySchema,
});

export type CreateCashBoxInput = z.infer<typeof createCashBoxSchema>;

/** Deposits and withdrawals share a shape; the action decides the direction. */
export const cashBoxMovementSchema = z.object({
  amount: moneySchema,
  movementDate: isoDateSchema,
  counterparty: z.enum(CASH_BOX_COUNTERPARTIES, { error: "Elige el origen o destino" }),
  description: optionalTrimmed(200),
  notes: optionalTrimmed(500),
});

export type CashBoxMovementInput = z.infer<typeof cashBoxMovementSchema>;

export const cashBoxTransferSchema = z.object({
  toCashBoxId: idSchema,
  amount: moneySchema,
  movementDate: isoDateSchema,
  description: optionalTrimmed(200),
  notes: optionalTrimmed(500),
});

export type CashBoxTransferInput = z.infer<typeof cashBoxTransferSchema>;

export const cashBoxAdjustmentSchema = z.object({
  amount: signedMoneySchema,
  movementDate: isoDateSchema,
  /** Required: an adjustment without an explanation is an unexplained balance. */
  notes: z.string().trim().min(3, { error: "Explica el motivo del ajuste" }).max(500),
});

export type CashBoxAdjustmentInput = z.infer<typeof cashBoxAdjustmentSchema>;

export const reassignLoanSchema = z.object({ cashBoxId: idSchema });

export type ReassignLoanInput = z.infer<typeof reassignLoanSchema>;
