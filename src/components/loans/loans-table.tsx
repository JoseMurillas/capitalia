import { HandCoins } from "lucide-react";
import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MoneyDisplay } from "@/components/shared/money-display";
import { InstallmentStatusBadge, LoanStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { formatPercent } from "@/lib/format";
import { FREQUENCY_LABELS } from "@/lib/labels";
import type { LoanSummaryDto } from "@/server/queries/loan-dto";

type LoansTableProps = {
  loans: LoanSummaryDto[];
  /** Hide the person column when the table is already scoped to one person. */
  showPerson?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  showCreateAction?: boolean;
};

export function LoansTable({
  loans,
  showPerson = true,
  emptyTitle = "No hay préstamos",
  emptyDescription = "Cuando registres un préstamo aparecerá aquí.",
  showCreateAction = true,
}: LoansTableProps) {
  const columns: DataTableColumn<LoanSummaryDto>[] = [
    ...(showPerson
      ? [
          {
            key: "person",
            header: "Persona",
            cell: (loan) => (
              <div className="min-w-0">
                <Link href={`/prestamos/${loan.id}`} className="font-medium hover:underline">
                  {loan.personName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {loan.numberOfInstallments} cuota{loan.numberOfInstallments === 1 ? "" : "s"} ·{" "}
                  {FREQUENCY_LABELS[loan.installmentFrequency].toLowerCase()}
                </p>
              </div>
            ),
          } satisfies DataTableColumn<LoanSummaryDto>,
        ]
      : [
          {
            key: "loan",
            header: "Préstamo",
            cell: (loan) => (
              <div className="min-w-0">
                <Link href={`/prestamos/${loan.id}`} className="font-medium hover:underline">
                  {formatDate(loan.startDate)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {loan.numberOfInstallments} cuota{loan.numberOfInstallments === 1 ? "" : "s"} ·{" "}
                  {FREQUENCY_LABELS[loan.installmentFrequency].toLowerCase()}
                </p>
              </div>
            ),
          } satisfies DataTableColumn<LoanSummaryDto>,
        ]),
    {
      key: "principal",
      header: "Capital",
      className: "text-right",
      cell: (loan) => <MoneyDisplay value={loan.principalAmount} />,
    },
    {
      key: "rate",
      header: "Interés",
      className: "text-right hidden sm:table-cell",
      cell: (loan) => (
        <span className="tabular-nums">{formatPercent(loan.monthlyInterestRate)} mensual</span>
      ),
    },
    {
      key: "balance",
      header: "Saldo",
      className: "text-right",
      cell: (loan) => (
        <MoneyDisplay value={loan.balance} tone={loan.balance > 0 ? "neutral" : "muted"} className="font-medium" />
      ),
    },
    {
      key: "next",
      header: "Próxima cuota",
      className: "hidden lg:table-cell",
      cell: (loan) =>
        loan.nextInstallment && loan.status !== "CANCELLED" ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm">
              #{loan.nextInstallment.installmentNumber} · {formatDate(loan.nextInstallment.dueDate)}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <MoneyDisplay value={loan.nextInstallment.pendingAmount} />
              <InstallmentStatusBadge status={loan.nextInstallment.status} />
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "dueDate",
      header: "Vencimiento",
      className: "hidden md:table-cell",
      cell: (loan) => formatDate(loan.dueDate),
    },
    {
      key: "status",
      header: "Estado",
      cell: (loan) => <LoanStatusBadge status={loan.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={loans}
      getRowId={(loan) => loan.id}
      emptyState={
        <EmptyState
          icon={HandCoins}
          title={emptyTitle}
          description={emptyDescription}
          action={
            showCreateAction ? (
              <Button asChild size="sm">
                <Link href="/prestamos/nuevo">Nuevo préstamo</Link>
              </Button>
            ) : null
          }
        />
      }
    />
  );
}
