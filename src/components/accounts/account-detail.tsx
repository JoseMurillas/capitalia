import { History } from "lucide-react";
import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileCard } from "@/components/shared/mobile-card";
import { MoneyDisplay } from "@/components/shared/money-display";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import type { AccountDetailDto, AccountEntryDto } from "@/server/queries/accounts";

import { AccountCard } from "./account-card";

type AccountDetailProps = {
  account: AccountDetailDto;
};

/** Money leaving the account is read as a loss, whatever wrote the row. */
function entryTone(entry: AccountEntryDto) {
  return entry.amount < 0 ? "danger" : "success";
}

/**
 * The account's ledger: its own movements and the finance movements assigned to
 * it, in one list with the balance after each one.
 */
export function AccountDetail({ account }: AccountDetailProps) {
  const columns: DataTableColumn<AccountEntryDto>[] = [
    {
      key: "date",
      header: "Fecha",
      cell: (entry) => <span className="whitespace-nowrap">{formatDate(entry.date)}</span>,
    },
    {
      key: "description",
      header: "Descripción",
      cell: (entry) =>
        entry.href ? (
          <Link href={entry.href} className="truncate font-medium hover:underline">
            {entry.description}
          </Link>
        ) : (
          <p className="truncate font-medium">{entry.description}</p>
        ),
    },
    {
      key: "kind",
      header: "Tipo",
      cell: (entry) => <StatusBadge tone={entryTone(entry)}>{entry.kind}</StatusBadge>,
    },
    {
      key: "amount",
      header: "Monto",
      className: "text-right",
      cell: (entry) => (
        <MoneyDisplay
          value={entry.amount}
          tone={entry.amount < 0 ? "negative" : "positive"}
          signed
          className="font-medium"
        />
      ),
    },
    {
      key: "balance",
      header: "Saldo",
      className: "text-right",
      cell: (entry) => <MoneyDisplay value={entry.runningBalance} tone="muted" />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AccountCard account={account} />

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
          <CardDescription>
            Todo lo que ha entrado y salido, con el saldo después de cada movimiento. El saldo sigue el orden en que
            se registraron las filas, no la fecha de cada una.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={account.entries}
            getRowId={(entry) => `${entry.source}-${entry.id}`}
            renderCard={(entry) => (
              <MobileCard
                title={entry.description}
                subtitle={formatDate(entry.date)}
                value={
                  <MoneyDisplay value={entry.amount} tone={entry.amount < 0 ? "negative" : "positive"} signed />
                }
                badge={<StatusBadge tone={entryTone(entry)}>{entry.kind}</StatusBadge>}
                href={entry.href ?? undefined}
                meta={[{ label: "Saldo", value: <MoneyDisplay value={entry.runningBalance} /> }]}
              />
            )}
            emptyState={
              <EmptyState
                icon={History}
                title="Sin movimientos"
                description="Registra un gasto o un ingreso desde esta cuenta para empezar su historia."
                className="py-6"
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
