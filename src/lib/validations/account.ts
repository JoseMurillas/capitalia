import { z } from "zod";

import {
  idSchema,
  isoDateSchema,
  moneySchema,
  nonNegativeMoneySchema,
  optionalTrimmed,
  signedMoneySchema,
} from "./common";

export const ACCOUNT_KINDS = ["DEBIT", "SAVINGS", "CASH", "WALLET"] as const;
export type AccountKindValue = (typeof ACCOUNT_KINDS)[number];

/**
 * The value the Movimientos list uses in `?cuenta=` to ask for the movements
 * that have no account. The accounts screen already links to it, so the string
 * is part of the URL contract and cannot be renamed on a whim.
 */
export const UNASSIGNED_ACCOUNT = "sin-cuenta";

/**
 * Only a card has last four digits, and the form only shows the field for one.
 * The value is kept loose here and judged below against the kind, because a
 * half-typed number left behind by switching the kind would otherwise fail a
 * field the user can no longer see — a dead Guardar button with nothing on
 * screen explaining it.
 */
const accountFields = {
  name: z.string().trim().min(2, { error: "Ponle un nombre a la cuenta" }).max(60),
  kind: z.enum(ACCOUNT_KINDS, { error: "Tipo de cuenta inválido" }),
  issuer: optionalTrimmed(60),
  // Deliberately unbounded: every rule about these digits is the one below, so a
  // length limit here could only fail a field that is off screen.
  last4: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value || null),
  notes: optionalTrimmed(500),
};

/** Drops the digits on anything that is not a card, and checks them on one. */
function checkLast4<T extends { kind: AccountKindValue; last4: string | null }>(
  account: T,
  ctx: z.RefinementCtx,
) {
  if (account.kind !== "DEBIT") {
    account.last4 = null;
    return;
  }
  if (account.last4 && !/^\d{4}$/.test(account.last4)) {
    ctx.addIssue({ code: "custom", path: ["last4"], message: "Deben ser los últimos 4 dígitos" });
  }
}

export const accountSchema = z.object(accountFields).superRefine(checkLast4);

/**
 * A new account opens with what it really holds today, like a cash box does.
 * `.extend` keeps the refinement above in Zod 4, so the rule is written once.
 */
export const createAccountSchema = accountSchema.extend({
  openingBalance: nonNegativeMoneySchema,
  openingDate: isoDateSchema,
});

export const accountTransferSchema = z.object({
  toAccountId: idSchema,
  amount: moneySchema,
  movementDate: isoDateSchema,
  description: optionalTrimmed(200),
  notes: optionalTrimmed(500),
});

export const accountAdjustmentSchema = z.object({
  /** Signed: a correction can go either way. */
  amount: signedMoneySchema,
  movementDate: isoDateSchema,
  description: z.string().trim().min(2, { error: "Explica el ajuste" }).max(200),
  notes: optionalTrimmed(500),
});

export const assignAccountSchema = z.object({
  transactionId: idSchema,
  accountId: idSchema,
});

export type AccountInput = z.infer<typeof accountSchema>;
export type AccountFormValues = z.input<typeof accountSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateAccountFormValues = z.input<typeof createAccountSchema>;
export type AccountTransferInput = z.infer<typeof accountTransferSchema>;
export type AccountTransferFormValues = z.input<typeof accountTransferSchema>;
export type AccountAdjustmentInput = z.infer<typeof accountAdjustmentSchema>;
export type AccountAdjustmentFormValues = z.input<typeof accountAdjustmentSchema>;
