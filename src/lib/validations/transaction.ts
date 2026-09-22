import { z } from "zod";

import { isoDateSchema, moneySchema, optionalTrimmed } from "./common";

export const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;
export const INCOME_CATEGORIES = ["SALARY", "LOAN_INTEREST", "OTHER_INCOME"] as const;
export const EXPENSE_CATEGORIES = [
  "FOOD",
  "TRANSPORT",
  "HOUSING",
  "SERVICES",
  "SUBSCRIPTIONS",
  "ENTERTAINMENT",
  "INSURANCE",
  "HEALTH",
  "EDUCATION",
  "DEBT",
  "CREDIT_CARD_PAYMENT",
  "OTHER_EXPENSE",
] as const;
export const TRANSACTION_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] as const;

export type TransactionCategoryValue = (typeof TRANSACTION_CATEGORIES)[number];
export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];

export function categoriesForType(type: "INCOME" | "EXPENSE") {
  return type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export const transactionSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES, { error: "Tipo inválido" }),
    category: z.enum(TRANSACTION_CATEGORIES, { error: "Categoría inválida" }),
    amount: moneySchema,
    description: z.string().trim().min(2, { error: "Describe el movimiento" }).max(200),
    transactionDate: isoDateSchema,
    notes: optionalTrimmed(1000),
  })
  .refine(
    (t) => (categoriesForType(t.type) as readonly string[]).includes(t.category),
    { error: "La categoría no corresponde al tipo", path: ["category"] },
  );

export type TransactionInput = z.infer<typeof transactionSchema>;
export type TransactionFormValues = z.input<typeof transactionSchema>;
