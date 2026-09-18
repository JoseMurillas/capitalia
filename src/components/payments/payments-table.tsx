import { Receipt } from "lucide-react";
import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileCard } from "@/components/shared/mobile-card";
import { MoneyDisplay } from "@/components/shared/money-display";
import { formatDate } from "@/lib/dates";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import type { PaymentDto } from "@/server/queries/loan-dto";

type PaymentsTableProps = {
  payments: PaymentDto[];
  /** Show who paid and link to the loan; off when already inside a loan. */
  showPerson?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
};

export function PaymentsTable({
  payments,
  showPerson = true,
  emptyTitle = "Sin pagos registrados",
  emptyDescription = "Los abonos que registres aparecerán aquí.",
  emptyAction,
}: PaymentsTableProps) {
  const columns: DataTableColumn<PaymentDto>[] = [
    {
      key: "date",
      header: "Fecha",
      cell: (p) => <span className="whitespace-nowrap">{formatDate(p.paymentDate)}</span>,
    },
    ...(showPerson
      ? [
          {
            key: "person",
            header: "Persona",
            cell: (p) => (
              <Link href={`/prestamos/${p.loanId}`} className="font-medium hover:underline">
                {p.personName}
              </Link>
            ),
          } satisfies DataTableColumn<PaymentDto>,
        ]
      : []),
    {
      key: "installment",
      header: "Cuota",
      className: "hidden sm:table-cell",
      cell: (p) => (p.installmentNumber ? `#${p.installmentNumber}` : "Automática"),
    },
    {
      key: "amount",
      header: "Monto",
      className: "text-right",
      cell: (p) => <MoneyDisplay value={p.amount} className="font-medium" />,
    },
    {
      key: "interest",
      header: "Interés",
      className: "text-right hidden md:table-cell",
      cell: (p) => <MoneyDisplay value={p.interestPaid} tone="positive" />,
    },
    {
      key: "principal",
      header: "Capital",
      className: "text-right hidden md:table-cell",
      cell: (p) => <MoneyDisplay value={p.principalPaid} />,
    },
    {
      key: "method",
      header: "Método",
      className: "hidden sm:table-cell",
      cell: (p) => PAYMENT_METHOD_LABELS[p.paymentMethod],
    },
    {
      key: "notes",
      header: "Notas",
      className: "hidden xl:table-cell max-w-56 truncate",
      cell: (p) => <span className="text-muted-foreground">{p.notes ?? "—"}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={payments}
      getRowId={(p) => p.id}
      renderCard={(p) => (
        <MobileCard
          href={showPerson ? `/prestamos/${p.loanId}` : undefined}
          title={showPerson ? p.personName : formatDate(p.paymentDate)}
          subtitle={
            showPerson
              ? `${formatDate(p.paymentDate)} · ${PAYMENT_METHOD_LABELS[p.paymentMethod]}`
              : `${p.installmentNumber ? `Cuota #${p.installmentNumber}` : "Cuota automática"} · ${PAYMENT_METHOD_LABELS[p.paymentMethod]}`
          }
          value={<MoneyDisplay value={p.amount} />}
          meta={[
            { label: "A intereses", value: <MoneyDisplay value={p.interestPaid} tone="positive" /> },
            { label: "A capital", value: <MoneyDisplay value={p.principalPaid} /> },
            ...(p.notes ? [{ label: "Notas", value: p.notes }] : []),
          ]}
        />
      )}
      emptyState={
        <EmptyState icon={Receipt} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      }
    />
  );
}
