import { Repeat } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TRANSACTION_CATEGORY_LABELS } from "@/lib/labels";
import type { RecurringSummary } from "@/server/queries/recurring";

type RecurringByCategoryProps = {
  summary: RecurringSummary;
  className?: string;
};

/** "Gastos recurrentes mensuales": monthly equivalent per category and the total committed. */
export function RecurringByCategory({ summary, className }: RecurringByCategoryProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Gastos recurrentes mensuales</CardTitle>
        <CardDescription>
          Equivalente mensual de {summary.activeCount} {summary.activeCount === 1 ? "gasto activo" : "gastos activos"}
          ; los que no son mensuales se prorratean.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {summary.byCategory.length === 0 ? (
          <EmptyState icon={Repeat} title="Sin gastos recurrentes" description="Registra tus pagos periódicos para ver cuánto comprometes cada mes." className="border-0 py-6" />
        ) : (
          <dl className="divide-y">
            {summary.byCategory.map((row) => (
              <div key={row.category} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <dt className="min-w-0">
                  <span className="font-medium">{TRANSACTION_CATEGORY_LABELS[row.category]}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {row.count} {row.count === 1 ? "gasto" : "gastos"}
                  </span>
                </dt>
                <dd>
                  <MoneyDisplay value={row.monthly} className="font-medium" />
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 pt-3">
              <dt className="font-semibold">Total mensual comprometido</dt>
              <dd>
                <MoneyDisplay value={summary.monthlyCommitted} className="text-lg font-semibold" />
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
