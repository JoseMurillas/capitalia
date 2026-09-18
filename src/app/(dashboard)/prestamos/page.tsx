import type { Metadata } from "next";

import { LoansList } from "@/components/loans/loans-list";
import { PageHeader } from "@/components/shared/page-header";
import { getEnum, getPage, getString } from "@/lib/search-params";
import { listLoans } from "@/server/queries/loans";

export const metadata: Metadata = { title: "Préstamos" };

const STATUS_FILTERS = ["ALL", "ACTIVE", "PAID", "OVERDUE", "CANCELLED"] as const;

export default async function LoansPage({ searchParams }: PageProps<"/prestamos">) {
  const params = await searchParams;
  const status = getEnum(params, "status", STATUS_FILTERS) ?? "ALL";
  const q = getString(params, "q");
  const page = getPage(params);

  const result = await listLoans({ status, q, page });

  return (
    <>
      <PageHeader
        title="Préstamos"
        description="Capital prestado, saldos y próximas cuotas de cada préstamo."
      />
      <LoansList result={result} status={status} query={q} />
    </>
  );
}
