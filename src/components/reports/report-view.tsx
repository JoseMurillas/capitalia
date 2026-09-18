import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CircleCheck,
  HandCoins,
  Percent,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { LoansTable } from "@/components/loans/loans-table";
import { MoneyDisplay } from "@/components/shared/money-display";
import { StatCard } from "@/components/shared/stat-card";
import { formatDate } from "@/lib/dates";
import type { LoanGroupTotals, ReportData } from "@/server/queries/reports";

function GroupTotals({ totals }: { totals: LoanGroupTotals }) {
  if (totals.count === 0) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {totals.count} préstamo{totals.count === 1 ? "" : "s"} · capital <MoneyDisplay value={totals.principal} /> ·
      intereses <MoneyDisplay value={totals.interest} /> · pagado <MoneyDisplay value={totals.paid} /> · saldo{" "}
      <MoneyDisplay value={totals.balance} className="font-medium" />
    </p>
  );
}

export function ReportView({ report }: { report: ReportData }) {
  const { period, portfolio, totals } = report;
  const periodLabel = `${formatDate(report.range.from)} – ${formatDate(report.range.to)}`;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Resultado del periodo</h2>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            title="Intereses generados"
            value={<MoneyDisplay value={period.interestGenerated} />}
            icon={Percent}
            tone="info"
            hint="Cuotas con vencimiento en el periodo"
          />
          <StatCard
            title="Intereses cobrados"
            value={<MoneyDisplay value={period.interestCollected} />}
            icon={Banknote}
            tone="positive"
            hint={`${period.paymentsReceived} pago${period.paymentsReceived === 1 ? "" : "s"} recibido${period.paymentsReceived === 1 ? "" : "s"}`}
          />
          <StatCard
            title="Capital recuperado"
            value={<MoneyDisplay value={period.principalCollected} />}
            icon={HandCoins}
            tone="info"
            hint={
              <>
                Nuevos préstamos: {period.newLoans} por <MoneyDisplay value={period.newLoansPrincipal} />
              </>
            }
          />
          <StatCard
            title="Utilidad"
            value={<MoneyDisplay value={period.profit} tone={period.profit < 0 ? "negative" : "neutral"} />}
            icon={TrendingUp}
            tone={period.profit < 0 ? "negative" : "positive"}
            hint="Ingresos + intereses cobrados − gastos"
          />
          <StatCard
            title="Ingresos"
            value={<MoneyDisplay value={period.income} />}
            icon={ArrowUpRight}
            tone="positive"
          />
          <StatCard
            title="Gastos"
            value={<MoneyDisplay value={period.expense} />}
            icon={ArrowDownRight}
            tone="negative"
          />
          <StatCard
            title="Capital pendiente"
            value={<MoneyDisplay value={portfolio.principalOutstanding} />}
            icon={Wallet}
            tone="warning"
            hint="Cartera vigente a hoy"
          />
          <StatCard
            title="Intereses por cobrar"
            value={<MoneyDisplay value={portfolio.interestOutstanding} />}
            icon={Scale}
            tone="warning"
            hint={
              <>
                Saldo total: <MoneyDisplay value={portfolio.balance} />
              </>
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-red-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Préstamos vencidos</h2>
        </div>
        <GroupTotals totals={totals.overdue} />
        <LoansTable
          loans={report.overdueLoans}
          emptyTitle="Sin préstamos vencidos"
          emptyDescription="Ningún préstamo tiene cuotas atrasadas a la fecha."
          showCreateAction={false}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <HandCoins className="size-4 text-sky-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Préstamos activos</h2>
        </div>
        <GroupTotals totals={totals.active} />
        <LoansTable
          loans={report.activeLoans}
          emptyTitle="Sin préstamos activos"
          emptyDescription="No hay préstamos al día con cuotas pendientes."
          showCreateAction={false}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CircleCheck className="size-4 text-emerald-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Préstamos pagados en el periodo</h2>
        </div>
        <GroupTotals totals={totals.paid} />
        <LoansTable
          loans={report.paidLoans}
          emptyTitle="Sin préstamos liquidados"
          emptyDescription="Ningún préstamo terminó de pagarse en este periodo."
          showCreateAction={false}
        />
      </section>
    </div>
  );
}
