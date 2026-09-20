import { ArrowDownRight, ArrowUpRight, Inbox, PiggyBank, Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TransactionsList } from "@/components/finance/transactions-list";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMonth, monthKey } from "@/lib/dates";
import { getEnum, getIsoDate, getPage } from "@/lib/search-params";
import { TRANSACTION_CATEGORIES, TRANSACTION_TYPES } from "@/lib/validations/transaction";
import { countPendingInbox } from "@/server/queries/inbox";
import { getFinanceSummary, listTransactions } from "@/server/queries/transactions";

export const metadata: Metadata = { title: "Finanzas" };

export default async function FinancePage({ searchParams }: PageProps<"/finanzas">) {
  const params = await searchParams;
  const from = getIsoDate(params, "from");
  const to = getIsoDate(params, "to");
  const type = getEnum(params, "type", TRANSACTION_TYPES);
  const category = getEnum(params, "category", TRANSACTION_CATEGORIES);
  const page = getPage(params);

  const [summary, result, pendingInbox] = await Promise.all([
    getFinanceSummary(),
    listTransactions({ from, to, type, category, page }),
    countPendingInbox(),
  ]);

  const hasFilters = Boolean(from || to || type || category);
  const month = formatMonth(monthKey(summary.monthLabel));

  return (
    <>
      <PageHeader
        title="Finanzas personales"
        description="Tus ingresos y gastos, separados del dinero que prestas."
        actions={
          <Button variant={pendingInbox > 0 ? "default" : "outline"} asChild>
            <Link href="/finanzas/bandeja">
              <Inbox aria-hidden="true" />
              Bandeja del banco
              {pendingInbox > 0 ? (
                <Badge variant="secondary" className="ml-1 tabular-nums">
                  {pendingInbox}
                </Badge>
              ) : null}
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title={`Ingresos de ${month}`}
          value={<MoneyDisplay value={summary.monthIncome} />}
          icon={ArrowUpRight}
          tone="positive"
        />
        <StatCard
          title={`Gastos de ${month}`}
          value={<MoneyDisplay value={summary.monthExpense} />}
          icon={ArrowDownRight}
          tone="negative"
        />
        <StatCard
          title="Balance del mes"
          value={<MoneyDisplay value={summary.monthBalance} tone={summary.monthBalance < 0 ? "negative" : "neutral"} />}
          icon={Scale}
          tone={summary.monthBalance < 0 ? "warning" : "info"}
        />
        <StatCard
          title="Dinero disponible"
          value={<MoneyDisplay value={summary.available} tone={summary.available < 0 ? "negative" : "neutral"} />}
          icon={PiggyBank}
          tone="positive"
          hint="Ingresos − gastos − capital prestado + pagos recibidos"
        />
      </div>

      {hasFilters ? (
        <p className="text-sm text-muted-foreground">
          En este filtro: ingresos <MoneyDisplay value={result.totals.income} tone="positive" /> · gastos{" "}
          <MoneyDisplay value={result.totals.expense} tone="negative" /> · balance{" "}
          <MoneyDisplay value={result.totals.balance} className="font-medium" />
        </p>
      ) : null}

      <TransactionsList result={result} type={type} category={category} hasFilters={hasFilters} />
    </>
  );
}
