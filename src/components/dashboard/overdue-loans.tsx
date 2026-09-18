import { CircleCheck } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { daysBetweenIso, formatDate, type IsoDate } from "@/lib/dates";
import type { LoanSummaryDto } from "@/server/queries/loan-dto";

export function OverdueLoans({ loans, today }: { loans: LoanSummaryDto[]; today: IsoDate }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Préstamos vencidos</CardTitle>
          <CardDescription>Con al menos una cuota atrasada.</CardDescription>
        </div>
        {loans.length > 0 ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/prestamos?status=OVERDUE">Ver todos</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {loans.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title="Todo al día"
            description="Ningún préstamo tiene cuotas vencidas."
            className="border-0 py-6"
          />
        ) : (
          <ul className="divide-y">
            {loans.map((loan) => {
              const next = loan.nextInstallment;
              const daysLate = next ? daysBetweenIso(next.dueDate, today) : 0;
              return (
                <li key={loan.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/prestamos/${loan.id}`} className="truncate font-medium hover:underline">
                      {loan.personName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {loan.overdueCount} cuota{loan.overdueCount === 1 ? "" : "s"} vencida
                      {loan.overdueCount === 1 ? "" : "s"}
                      {next ? ` · desde ${formatDate(next.dueDate)} (${daysLate} día${daysLate === 1 ? "" : "s"})` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <MoneyDisplay value={loan.balance} tone="negative" className="font-medium" />
                    <p className="text-xs text-muted-foreground">saldo total</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
