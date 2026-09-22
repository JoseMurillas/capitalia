import { z } from "zod";

import { isIsoDate } from "@/lib/dates";

// Default Zod messages (type errors, etc.) in Spanish; custom messages stay as written.
z.config(z.locales.es());

/** `yyyy-MM-dd` string; the only date format that crosses the client boundary. */
export const isoDateSchema = z
  .string({ error: "Fecha requerida" })
  .refine(isIsoDate, { error: "Fecha inválida" });

/** Optional date: empty input, null and undefined all normalise to null. */
export const optionalIsoDateSchema = z
  .union([isoDateSchema, z.literal(""), z.null()])
  .transform((v) => (v ? v : null))
  .optional();

/** Money typed by the user: positive, at most two decimals, within DECIMAL(15,2). */
export const moneySchema = z.coerce
  .number({ error: "Monto requerido" })
  .positive({ error: "El monto debe ser mayor que cero" })
  .max(9_999_999_999_999, { error: "Monto demasiado grande" })
  .refine((v) => Math.round(v * 100) / 100 === v, { error: "Máximo dos decimales" });

/** Money that may legitimately be zero (card balances). */
export const nonNegativeMoneySchema = z.coerce
  .number({ error: "Monto requerido" })
  .min(0, { error: "El monto no puede ser negativo" })
  .max(9_999_999_999_999, { error: "Monto demasiado grande" })
  .refine((v) => Math.round(v * 100) / 100 === v, { error: "Máximo dos decimales" });

/** Optional money: empty input, null and undefined all normalise to null. */
export const optionalMoneySchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  nonNegativeMoneySchema.nullable(),
);

/** Days before a due date the app starts warning (0 = only on the day). */
export const reminderDaysSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce
    .number({ error: "Días requeridos" })
    .int({ error: "Debe ser un número entero" })
    .min(0, { error: "Mínimo 0 días" })
    .max(60, { error: "Máximo 60 días" }),
);

export const reminderSettingsSchema = z.object({ days: reminderDaysSchema });

export const idSchema = z.string().trim().min(1, { error: "Identificador requerido" });

/**
 * Optional free text. Accepts undefined/null too because forms re-submit the
 * already-transformed value (null) to the server, which validates again.
 */
export const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres` })
    .nullish()
    .transform((v) => (v ? v : null));

export const dateRangeSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine((r) => r.from <= r.to, { error: "La fecha inicial debe ser anterior a la final", path: ["to"] });

export type DateRange = z.infer<typeof dateRangeSchema>;

/** Money that can go either way (an adjustment), never zero. */
export const signedMoneySchema = z.coerce
  .number({ error: "Monto requerido" })
  .refine((v) => v !== 0, { error: "El monto no puede ser cero" })
  .refine((v) => Math.abs(v) <= 9_999_999_999_999, { error: "Monto demasiado grande" })
  .refine((v) => Math.round(v * 100) / 100 === v, { error: "Máximo dos decimales" });
