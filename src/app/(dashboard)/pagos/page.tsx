import { Banknote, HandCoins, Percent, Receipt } from "lucide-react";
import type { Metadata } from "next";

import { PaymentsList } from "@/components/payments/payments-list";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getIsoDate, getPage, getString } from "@/lib/search-params";
import { listOpenLoanOptions } from "@/server/queries/loans";
import { listPayments } from "@/server/queries/payments";

export const metadata: Metadata = { title: "Pagos" };

export default async function PaymentsPage({ searchParams }: PageProps<"/pagos">) {
  const params = await searchParams;
  const q = getString(params, "q");
  const from = getIsoDate(params, "from");
  const to = getIsoDate(params, "to");
  const page = getPage(params);

  const [result, openLoans] = await Promise.all([
    listPayments({ q, from, to, page }),
    listOpenLoanOptions(),
  ]);

  const hasFilters = Boolean(q || from || to);

  return (
    <>
      <PageHeader
        title="Pagos"
        description="Todos los abonos recibidos y cómo se distribuyeron entre intereses y capital."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title={hasFilters ? "Pagos en el filtro" : "Pagos registrados"}
          value={result.totals.count}
          icon={Receipt}
        />
        <StatCard
          title="Total recibido"
          value={<MoneyDisplay value={result.totals.amount} />}
          icon={Banknote}
          tone="positive"
        />
        <StatCard
          title="A intereses"
          value={<MoneyDisplay value={result.totals.interest} />}
          icon={Percent}
          tone="positive"
        />
        <StatCard
          title="A capital"
          value={<MoneyDisplay value={result.totals.principal} />}
          icon={HandCoins}
          tone="info"
        />
      </div>

      <PaymentsList result={result} openLoans={openLoans} hasFilters={hasFilters} />
    </>
  );
}
