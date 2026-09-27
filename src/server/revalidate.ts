import "server-only";

import { revalidatePath } from "next/cache";

const FINANCE_PATHS = [
  "/finanzas",
  "/finanzas/cuentas",
  "/finanzas/movimientos",
  "/finanzas/recurrentes",
  "/finanzas/tarjetas",
  "/prestamos/cajas",
  "/prestamos/recordatorios",
  "/dashboard",
  "/reportes",
];

/** Every page that shows cash, commitments or monthly totals after a finance write. */
export function revalidateFinance() {
  for (const path of FINANCE_PATHS) revalidatePath(path);
}

/**
 * One account's own page, which `revalidateFinance` cannot cover: the list of
 * accounts is a fixed path, a single account's ledger is a dynamic one. Every
 * write that lands a row in an account has to call this, or that account keeps
 * showing the balance it had before.
 */
export function revalidateAccountDetail(...accountIds: (string | null | undefined)[]) {
  for (const id of new Set(accountIds.filter((id): id is string => Boolean(id)))) {
    revalidatePath(`/finanzas/cuentas/${id}`);
  }
}
