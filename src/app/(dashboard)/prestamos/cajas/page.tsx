import { Coins, HandCoins, Percent, PiggyBank } from "lucide-react";
import type { Metadata } from "next";

import { CashBoxesList } from "@/components/cash-boxes/cash-boxes-list";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getCashBoxesSummary, listCashBoxes, listCashBoxOptions } from "@/server/queries/cash-boxes";

export const metadata: Metadata = { title: "Cajas" };

export default async function CashBoxesPage() {
  const [boxes, summary, options] = await Promise.all([
    listCashBoxes(),
    getCashBoxesSummary(),
    listCashBoxOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Cajas de capital"
        description="De qué fondo sale cada préstamo y dónde está tu dinero en cada momento."
        backHref="/prestamos"
        backLabel="Préstamos"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title="Capital total"
          value={<MoneyDisplay value={summary.totalCapital} />}
          icon={Coins}
          tone="info"
          hint="Disponible + prestado"
        />
        <StatCard
          title="Disponible para prestar"
          value={<MoneyDisplay value={summary.totalAvailable} />}
          icon={PiggyBank}
          tone="positive"
          hint={`${summary.count} ${summary.count === 1 ? "caja activa" : "cajas activas"}`}
        />
        <StatCard
          title="Prestado"
          value={<MoneyDisplay value={summary.totalLent} />}
          icon={HandCoins}
          tone="warning"
          hint="Capital pendiente de cobro"
        />
        <StatCard
          title="Intereses ganados"
          value={<MoneyDisplay value={summary.interestEarned} />}
          icon={Percent}
          tone="positive"
          hint="Cobrados en préstamos de estas cajas"
        />
      </div>

      <CashBoxesList boxes={boxes} options={options} />
    </>
  );
}
