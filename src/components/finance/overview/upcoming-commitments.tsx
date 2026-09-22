import { CalendarCheck, CreditCard, Repeat } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { MoneyDisplay } from "@/components/shared/money-display";
import { CommitmentStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { dueInLabel } from "@/lib/labels";
import type { UpcomingCommitments as UpcomingCommitmentsData } from "@/server/queries/commitments";

type UpcomingCommitmentsProps = {
  upcoming: UpcomingCommitmentsData;
  className?: string;
};

/** What the user must pay in the coming days: recurring expenses and card statements together. */
export function UpcomingCommitments({ upcoming, className }: UpcomingCommitmentsProps) {
  const { items, total, horizonDays } = upcoming;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Próximos compromisos</CardTitle>
        <CardDescription>Recurrentes y tarjetas que vencen en los próximos {horizonDays} días.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Nada por pagar" description={`No hay compromisos en los próximos ${horizonDays} días.`} className="border-0 py-6" />
        ) : (
          <>
            <ul className="divide-y">
              {items.map((c) => (
                <li key={`${c.kind}-${c.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {c.kind === "CARD" ? <CreditCard className="size-4" aria-hidden="true" /> : <Repeat className="size-4" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={c.kind === "CARD" ? `/finanzas/tarjetas/${c.id}` : "/finanzas/recurrentes"}
                        className="truncate font-medium hover:underline"
                      >
                        {c.kind === "CARD" ? `Tarjeta ${c.name}` : c.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(c.dueDate)} · {dueInLabel(c.daysUntilDue)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <MoneyDisplay value={c.amount} className="font-medium" />
                    {c.status !== "UPCOMING" ? <CommitmentStatusBadge status={c.status} /> : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="text-sm font-medium">Total próximo</span>
              <MoneyDisplay value={total} className="font-semibold" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
