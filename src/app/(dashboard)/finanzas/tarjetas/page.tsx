import { CreditCard, Landmark, Receipt, Wallet } from "lucide-react";
import type { Metadata } from "next";

import { CreditCardsList } from "@/components/finance/cards/credit-cards-list";
import { FinanceNav } from "@/components/finance/finance-nav";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getCreditCardsSummary, listCreditCards } from "@/server/queries/credit-cards";
import { countPendingInbox } from "@/server/queries/inbox";
import { getDefaultReminderDays } from "@/server/services/settings";

export const metadata: Metadata = { title: "Tarjetas de crédito" };

export default async function CreditCardsPage() {
  const [cards, summary, defaultReminderDays, pendingInbox] = await Promise.all([
    listCreditCards(),
    getCreditCardsSummary(),
    getDefaultReminderDays(),
    countPendingInbox(),
  ]);

  return (
    <>
      <PageHeader
        title="Tarjetas de crédito"
        description="Cupo, saldo y pagos de cada tarjeta. El cupo nunca cuenta como dinero disponible."
      />
      <FinanceNav pendingInbox={pendingInbox} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title="Tarjetas activas" value={summary.count} icon={CreditCard} tone="info" />
        <StatCard
          title="Deuda total"
          value={<MoneyDisplay value={summary.totalDebt} tone={summary.totalDebt > 0 ? "negative" : "neutral"} />}
          icon={Landmark}
          tone="negative"
          hint="Saldos pendientes sumados"
        />
        <StatCard
          title="Cupo disponible"
          value={<MoneyDisplay value={summary.totalAvailable} />}
          icon={Wallet}
          tone="default"
          hint="No es dinero tuyo: es crédito"
        />
        <StatCard
          title="Pagos de este mes"
          value={<MoneyDisplay value={summary.paymentsThisMonth} />}
          icon={Receipt}
          tone="warning"
          hint="Pago planeado o mínimo de cada tarjeta"
        />
      </div>

      <CreditCardsList cards={cards} defaultReminderDays={defaultReminderDays} />
    </>
  );
}
