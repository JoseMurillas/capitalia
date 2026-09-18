import "server-only";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";

import { type ActionResult, fail } from "@/types";

import { ServiceError } from "./errors";

export const GENERIC_ERROR = "Ocurrió un error inesperado. Intenta de nuevo.";
export const VALIDATION_ERROR = "Revisa los campos marcados.";

export type ParseOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; result: ActionResult<never> };

/** Validates untrusted client input with a Zod schema and shapes the failure for the UI. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): ParseOutcome<z.output<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const { fieldErrors } = z.flattenError(parsed.error);
  return {
    ok: false,
    result: fail(VALIDATION_ERROR, fieldErrors as Record<string, string[]>),
  };
}

/**
 * Runs an action body and converts known failures into `ActionResult`s.
 * Redirects thrown by Next.js are re-thrown so navigation keeps working.
 */
export async function runAction<T>(body: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ServiceError) return fail(error.message, error.fieldErrors);
    console.error(error);
    return fail(GENERIC_ERROR);
  }
}
