import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UNASSIGNED_ACCOUNT } from "@/lib/validations/account";

type UnassignedNoticeProps = {
  /** Finance movements still without an account. Nothing renders when it is zero. */
  count: number;
  className?: string;
};

/**
 * The one warning about incomplete balances (spec §4.2), shown by every screen
 * that adds accounts up: the list of accounts and the Resumen. It is written
 * once because it is the same sentence about the same number, and two copies
 * would drift the day the copy or the link changes.
 */
export function UnassignedNotice({ count, className }: UnassignedNoticeProps) {
  if (count <= 0) return null;

  return (
    // The card outline is a ring, so the warning tints the ring, not a border.
    <Card className={cn("justify-center py-4 ring-amber-400/70 dark:ring-amber-500/50", className)}>
      <CardContent className="flex items-start gap-3 px-3 sm:px-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
          <AlertTriangle className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-medium">
            {count === 1 ? "Falta 1 movimiento por asignar" : `Faltan ${count} movimientos por asignar`}
          </p>
          <p className="text-xs text-muted-foreground">
            Los saldos están incompletos hasta que cada movimiento tenga su cuenta.{" "}
            <Link
              href={`/finanzas/movimientos?cuenta=${UNASSIGNED_ACCOUNT}`}
              className="font-medium underline underline-offset-3 hover:text-foreground"
            >
              Asignarlos ahora
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
