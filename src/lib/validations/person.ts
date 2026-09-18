import { z } from "zod";

import { optionalTrimmed } from "./common";

export const personSchema = z.object({
  name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres" }).max(120),
  phone: optionalTrimmed(30),
  email: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.email().safeParse(v).success, { error: "Correo inválido" }),
  document: optionalTrimmed(30),
  address: optionalTrimmed(200),
  notes: optionalTrimmed(1000),
});

export type PersonInput = z.infer<typeof personSchema>;
/** Shape the form works with before Zod transforms optional strings into null. */
export type PersonFormValues = z.input<typeof personSchema>;
