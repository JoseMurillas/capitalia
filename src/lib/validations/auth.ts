import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ error: "Correo inválido" }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Contraseña requerida" }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres" }).max(120),
  email: z.email({ error: "Correo inválido" }).trim().toLowerCase(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Ingresa tu contraseña actual" }),
    newPassword: z
      .string()
      .min(8, { error: "Mínimo 8 caracteres" })
      .regex(/[A-Za-z]/, { error: "Debe incluir una letra" })
      .regex(/[0-9]/, { error: "Debe incluir un número" }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
