import { PiggyBank } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LoansList } from "@/components/loans/loans-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getEnum, getPage, getString } from "@/lib/search-params";
import { listCashBoxOptions } from "@/server/queries/cash-boxes";
import { listLoans } from "@/server/queries/loans";

export const metadata: Metadata = { title: "Préstamos" };

const STATUS_FILTERS = ["ALL", "ACTIVE", "PAID", "OVERDUE", "CANCELLED"] as const;

export default async function LoansPage({ searchParams }: PageProps<"/prestamos">) {
  const params = await searchParams;
  const status = getEnum(params, "status", STATUS_FILTERS) ?? "ALL";
  const q = getString(params, "q");
  const page = getPage(params);
  const cashBoxId = getString(params, "cashBox");
  const [result, cashBoxes] = await Promise.all([
    listLoans({ status, q, cashBoxId, page }),
    listCashBoxOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Préstamos"
        description="Capital prestado, saldos y próximas cuotas de cada préstamo."
        actions={
          <Button variant="outline" asChild>
            <Link href="/prestamos/cajas">
              <PiggyBank aria-hidden="true" />
              Cajas
            </Link>
          </Button>
        }
      />
      <LoansList result={result} status={status} query={q} cashBoxes={cashBoxes} cashBoxId={cashBoxId} />
    </>
  );
}
