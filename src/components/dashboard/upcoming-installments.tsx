import { CalendarCheck } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { MoneyDisplay } from "@/components/shared/money-display";
import { InstallmentStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import type { UpcomingInstallment } from "@/server/queries/dashboard";

function dueLabel(days: number): string {
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence mañana";
  return `En ${days} días`;
}

export function UpcomingInstallments({ installments }: { installments: UpcomingInstallment[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos pagos</CardTitle>
        <CardDescription>Cuotas que vencen en los próximos 14 días.</CardDescription>
      </CardHeader>
      <CardContent>
        {installments.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Nada por vencer"
            description="No hay cuotas pendientes en las próximas dos semanas."
            className="border-0 py-6"
          />
        ) : (
          <ul className="divide-y">
            {installments.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/prestamos/${i.loanId}`} className="truncate font-medium hover:underline">
                    {i.personName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Cuota #{i.installmentNumber} · {formatDate(i.dueDate)} · {dueLabel(i.daysUntilDue)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <MoneyDisplay value={i.pendingAmount} className="font-medium" />
                  {i.status === "PARTIAL" ? <InstallmentStatusBadge status={i.status} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
