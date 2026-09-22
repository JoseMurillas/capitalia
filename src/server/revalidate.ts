import "server-only";

import { revalidatePath } from "next/cache";

const FINANCE_PATHS = [
  "/finanzas",
  "/finanzas/movimientos",
  "/finanzas/recurrentes",
  "/finanzas/tarjetas",
  "/prestamos/cajas",
  "/dashboard",
  "/reportes",
];

/** Every page that shows cash, commitments or monthly totals after a finance write. */
export function revalidateFinance() {
  for (const path of FINANCE_PATHS) revalidatePath(path);
}
