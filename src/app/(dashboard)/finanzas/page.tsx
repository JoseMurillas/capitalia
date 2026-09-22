import { ArrowDownRight, ArrowUpRight, CreditCard, PiggyBank, Repeat, ShieldAlert, Wallet } from "lucide-react";
import type { Metadata } from "next";

import { FinanceNav } from "@/components/finance/finance-nav";
import { CommitmentAlerts } from "@/components/finance/overview/commitment-alerts";
import { CreditCardsMini } from "@/components/finance/overview/credit-cards-mini";
import { RecurringByCategory } from "@/components/finance/overview/recurring-by-category";
import { UpcomingCommitments } from "@/components/finance/overview/upcoming-commitments";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { formatMonth, monthKey } from "@/lib/dates";
import { getCommitmentsOverview } from "@/server/queries/commitments";
import { countPendingInbox } from "@/server/queries/inbox";

export const metadata: Metadata = { title: "Finanzas" };

export default async function FinanceOverviewPage() {
  const [overview, pendingInbox] = await Promise.all([getCommitmentsOverview(), countPendingInbox()]);
  const month = formatMonth(monthKey(overview.today));

  return (
    <>
      <PageHeader
        title="Finanzas personales"
        description="Lo que entra, lo que sale y lo que ya está comprometido. El cupo de las tarjetas nunca cuenta como dinero."
      />
      <FinanceNav pendingInbox={pendingInbox} />

      <CommitmentAlerts alerts={overview.alerts} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title={`Ingresos de ${month}`} value={<MoneyDisplay value={overview.monthIncome} />} icon={ArrowUpRight} tone="positive" />
        <StatCard title={`Gastos de ${month}`} value={<MoneyDisplay value={overview.monthExpense} />} icon={ArrowDownRight} tone="negative" hint="Incluye recurrentes y pagos de tarjeta ya hechos" />
        <StatCard
          title="Recurrentes pendientes"
          value={<MoneyDisplay value={overview.recurringPending} />}
          icon={Repeat}
          tone="warning"
          hint="Por pagar en efectivo o transferencia este mes"
        />
        <StatCard
          title="Pagos de tarjetas"
          value={<MoneyDisplay value={overview.cardPending} />}
          icon={CreditCard}
          tone="warning"
          hint="Pago planeado o mínimo con fecha este mes"
        />
        <StatCard
          title="Disponible estimado"
          value={<MoneyDisplay value={overview.estimatedAvailable} tone={overview.estimatedAvailable < 0 ? "negative" : "positive"} />}
          icon={Wallet}
          tone={overview.estimatedAvailable < 0 ? "negative" : "positive"}
          hint="Ingresos − gastos − compromisos pendientes del mes"
        />
        <StatCard
          title="Reserva necesaria"
          value={<MoneyDisplay value={overview.reserveNeeded} />}
          icon={ShieldAlert}
          tone="info"
          hint="Recurrentes + tarjetas pendientes este mes"
        />
        <StatCard
          title="Dinero disponible"
          value={<MoneyDisplay value={overview.cashAvailable} tone={overview.cashAvailable < 0 ? "negative" : "neutral"} />}
          icon={PiggyBank}
          tone="positive"
          hint="Caja: ingresos − gastos − prestado + cobrado"
        />
        <StatCard
          title="Comprometido al mes"
          value={<MoneyDisplay value={overview.monthlyCommitted} />}
          icon={Repeat}
          tone="default"
          hint={`Equivalente mensual de ${overview.activeRecurringCount} recurrentes`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <UpcomingCommitments upcoming={overview.upcoming} className="xl:col-span-2" />
        <CreditCardsMini cards={overview.cards} />
      </div>

      <RecurringByCategory summary={overview.recurringSummary} />
    </>
  );
}
