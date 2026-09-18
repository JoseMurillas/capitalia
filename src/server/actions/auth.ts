"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/auth";
import { parseInput, runAction } from "@/server/action-utils";
import { type ActionResult, fail, ok } from "@/types";

const DEFAULT_REDIRECT = "/dashboard";

function safeRedirectTarget(candidate: unknown): string {
  if (typeof candidate !== "string") return DEFAULT_REDIRECT;
  // Only allow same-origin relative paths to prevent open redirects.
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return DEFAULT_REDIRECT;
  if (candidate.startsWith("/login")) return DEFAULT_REDIRECT;
  return candidate;
}

export async function loginAction(
  input: unknown,
  callbackUrl?: string,
): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const parsed = parseInput(loginSchema, input);
    if (!parsed.ok) return parsed.result;

    try {
      await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return fail("Correo o contraseña incorrectos");
      }
      throw error;
    }

    return ok({ redirectTo: safeRedirectTarget(callbackUrl) });
  });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
