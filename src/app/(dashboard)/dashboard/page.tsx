import {
  AlertTriangle,
  Banknote,
  HandCoins,
  Percent,
  PiggyBank,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CashFlowChart } from "@/components/dashboard/cash-flow-chart";
import { InterestChart } from "@/components/dashboard/interest-chart";
import { LoanStatusChart } from "@/components/dashboard/loan-status-chart";
import { OverdueLoans } from "@/components/dashboard/overdue-loans";
import { UpcomingInstallments } from "@/components/dashboard/upcoming-installments";
import { UpcomingCommitments } from "@/components/finance/overview/upcoming-commitments";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateLong, formatMonth, monthKey } from "@/lib/dates";
import { getUpcomingCommitments } from "@/server/queries/commitments";
import { getDashboardData } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [data, commitments] = await Promise.all([getDashboardData(), getUpcomingCommitments()]);
  const { metrics } = data;
  const month = formatMonth(monthKey(data.today));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Resumen al ${formatDateLong(data.today)}.`}
        actions={
          <Button asChild>
            <Link href="/prestamos/nuevo">
              <Plus aria-hidden="true" />
              Nuevo préstamo
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title="Capital prestado"
          value={<MoneyDisplay value={metrics.capitalLent} />}
          icon={HandCoins}
          tone="info"
          hint="En préstamos activos y vencidos"
        />
        <StatCard
          title="Dinero por cobrar"
          value={<MoneyDisplay value={metrics.receivable} />}
          icon={Wallet}
          tone="warning"
          hint="Capital + intereses pendientes"
        />
        <StatCard
          title="Intereses generados"
          value={<MoneyDisplay value={metrics.interestGenerated} />}
          icon={Percent}
          tone="positive"
          hint="Programados en todos los préstamos"
        />
        <StatCard
          title="Intereses cobrados"
          value={<MoneyDisplay value={metrics.interestCollected} />}
          icon={Banknote}
          tone="positive"
          hint="Recibidos hasta hoy"
        />
        <StatCard
          title={`Ganancias de ${month}`}
          value={<MoneyDisplay value={metrics.monthProfit} />}
          icon={TrendingUp}
          tone="positive"
          hint="Intereses cobrados este mes"
        />
        <StatCard
          title="Préstamos activos"
          value={metrics.activeLoans}
          icon={HandCoins}
          tone="info"
        />
        <StatCard
          title="Préstamos vencidos"
          value={metrics.overdueLoans}
          icon={AlertTriangle}
          tone={metrics.overdueLoans > 0 ? "negative" : "default"}
        />
        <StatCard
          title="Dinero disponible"
          value={<MoneyDisplay value={metrics.available} tone={metrics.available < 0 ? "negative" : "neutral"} />}
          icon={PiggyBank}
          tone="positive"
          hint="Ingresos − gastos − prestado + cobrado"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Ingresos vs gastos</CardTitle>
            <CardDescription>Movimientos personales de los últimos 6 meses.</CardDescription>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={data.monthlyCashFlow} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Estado de préstamos</CardTitle>
            <CardDescription>Cantidad por estado.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoanStatusChart data={data.loanStatus} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Intereses cobrados por mes</CardTitle>
            <CardDescription>Ganancia real recibida en cada mes.</CardDescription>
          </CardHeader>
          <CardContent>
            <InterestChart data={data.monthlyInterest} />
          </CardContent>
        </Card>
        <UpcomingCommitments upcoming={commitments} />
        <UpcomingInstallments installments={data.upcomingInstallments} />
        <OverdueLoans loans={data.overdueLoans} today={data.today} />
      </div>
    </>
  );
}
