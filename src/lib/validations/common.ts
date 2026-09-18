import { z } from "zod";

import { isIsoDate } from "@/lib/dates";

/** `yyyy-MM-dd` string; the only date format that crosses the client boundary. */
export const isoDateSchema = z
  .string({ error: "Fecha requerida" })
  .refine(isIsoDate, { error: "Fecha inválida" });

/** Money typed by the user: positive, at most two decimals, within DECIMAL(15,2). */
export const moneySchema = z.coerce
  .number({ error: "Monto requerido" })
  .positive({ error: "El monto debe ser mayor que cero" })
  .max(9_999_999_999_999, { error: "Monto demasiado grande" })
  .refine((v) => Math.round(v * 100) / 100 === v, { error: "Máximo dos decimales" });

export const idSchema = z.string().trim().min(1, { error: "Identificador requerido" });

export const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres` })
    .optional()
    .transform((v) => (v ? v : null));

export const dateRangeSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine((r) => r.from <= r.to, { error: "La fecha inicial debe ser anterior a la final", path: ["to"] });

export type DateRange = z.infer<typeof dateRangeSchema>;
