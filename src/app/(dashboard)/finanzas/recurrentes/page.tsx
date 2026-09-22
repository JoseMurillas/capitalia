import { CalendarClock, Repeat } from "lucide-react";
import type { Metadata } from "next";

import { FinanceNav } from "@/components/finance/finance-nav";
import { RecurringByCategory } from "@/components/finance/overview/recurring-by-category";
import { RecurringList } from "@/components/finance/recurring/recurring-list";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getEnum } from "@/lib/search-params";
import { RECURRING_STATUS_FILTERS } from "@/lib/validations/recurring";
import { EXPENSE_CATEGORIES } from "@/lib/validations/transaction";
import { listCreditCardOptions } from "@/server/queries/credit-cards";
import { countPendingInbox } from "@/server/queries/inbox";
import { getRecurringSummary, listRecurringExpenses } from "@/server/queries/recurring";
import { getDefaultReminderDays } from "@/server/services/settings";

export const metadata: Metadata = { title: "Gastos recurrentes" };

export default async function RecurringPage({ searchParams }: PageProps<"/finanzas/recurrentes">) {
  const params = await searchParams;
  const status = getEnum(params, "status", RECURRING_STATUS_FILTERS) ?? "active";
  const category = getEnum(params, "category", EXPENSE_CATEGORIES);

  const [expenses, summary, cards, defaultReminderDays, pendingInbox] = await Promise.all([
    listRecurringExpenses({ status, category }),
    getRecurringSummary(),
    listCreditCardOptions(),
    getDefaultReminderDays(),
    countPendingInbox(),
  ]);

  return (
    <>
      <PageHeader
        title="Gastos recurrentes"
        description="Pagos periódicos con aviso antes de cada vencimiento. Marcar pagado registra el gasto y programa el siguiente."
      />
      <FinanceNav pendingInbox={pendingInbox} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:col-span-1 xl:grid-cols-1">
          <StatCard
            title="Comprometido al mes"
            value={<MoneyDisplay value={summary.monthlyCommitted} />}
            icon={Repeat}
            tone="warning"
            hint={`${summary.activeCount} ${summary.activeCount === 1 ? "gasto activo" : "gastos activos"}`}
          />
          <StatCard
            title="Por vencer o vencidos"
            value={summary.alertCount}
            icon={CalendarClock}
            tone={summary.alertCount > 0 ? "negative" : "positive"}
            hint="Dentro de su ventana de aviso"
          />
        </div>
        <RecurringByCategory summary={summary} className="xl:col-span-2" />
      </div>

      <RecurringList expenses={expenses} cards={cards} defaultReminderDays={defaultReminderDays} status={status} category={category} />
    </>
  );
}
