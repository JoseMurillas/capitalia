"use client";

import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, HandCoins, History, Scale } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileCard } from "@/components/shared/mobile-card";
import { MoneyDisplay } from "@/components/shared/money-display";
import { LoanStatusBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { CASH_BOX_COUNTERPARTY_LABELS, CASH_BOX_MOVEMENT_KIND_LABELS } from "@/lib/labels";
import type { CashBoxDetailDto, CashBoxLoanDto, CashBoxMovementDto, CashBoxOption } from "@/server/queries/cash-boxes";

import { CashBoxCard } from "./cash-box-card";
import { CashBoxMovementDialog, type CashBoxMovementMode } from "./cash-box-movement-dialog";

type CashBoxDetailProps = {
  box: CashBoxDetailDto;
  options: CashBoxOption[];
};

/** Where the movement came from or went, in one readable cell. */
function movementContext(movement: CashBoxMovementDto): string {
  if (movement.relatedCashBoxName) return movement.relatedCashBoxName;
  if (movement.counterparty) return CASH_BOX_COUNTERPARTY_LABELS[movement.counterparty];
  return "—";
}

export function CashBoxDetail({ box, options }: CashBoxDetailProps) {
  const [mode, setMode] = useState<CashBoxMovementMode | null>(null);

  const movementColumns: DataTableColumn<CashBoxMovementDto>[] = [
    {
      key: "date",
      header: "Fecha",
      cell: (m) => <span className="whitespace-nowrap">{formatDate(m.movementDate)}</span>,
    },
    {
      key: "kind",
      header: "Tipo",
      cell: (m) => (
        <StatusBadge tone={m.amount < 0 ? "danger" : "success"}>{CASH_BOX_MOVEMENT_KIND_LABELS[m.kind]}</StatusBadge>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      cell: (m) => (
        <div className="min-w-0">
          {m.loanId ? (
            <Link href={`/prestamos/${m.loanId}`} className="truncate font-medium hover:underline">
              {m.description}
            </Link>
          ) : (
            <p className="truncate font-medium">{m.description}</p>
          )}
          {m.notes ? <p className="truncate text-xs text-muted-foreground">{m.notes}</p> : null}
        </div>
      ),
    },
    {
      key: "context",
      header: "Origen / destino",
      className: "hidden lg:table-cell",
      cell: movementContext,
    },
    {
      key: "amount",
      header: "Monto",
      className: "text-right",
      cell: (m) => (
        <MoneyDisplay value={m.amount} tone={m.amount < 0 ? "negative" : "positive"} signed className="font-medium" />
      ),
    },
    {
      key: "balance",
      header: "Saldo",
      className: "text-right",
      cell: (m) => <MoneyDisplay value={m.balance} tone="muted" />,
    },
  ];

  const loanColumns: DataTableColumn<CashBoxLoanDto>[] = [
    {
      key: "person",
      header: "Persona",
      cell: (loan) => (
        <Link href={`/prestamos/${loan.id}`} className="font-medium hover:underline">
          {loan.personName}
        </Link>
      ),
    },
    { key: "start", header: "Inicio", className: "hidden sm:table-cell", cell: (loan) => formatDate(loan.startDate) },
    { key: "principal", header: "Capital", className: "text-right", cell: (loan) => <MoneyDisplay value={loan.principalAmount} /> },
    {
      key: "balance",
      header: "Capital pendiente",
      className: "text-right",
      cell: (loan) => <MoneyDisplay value={loan.principalBalance} className="font-medium" />,
    },
    { key: "status", header: "Estado", className: "text-right", cell: (loan) => <LoanStatusBadge status={loan.status} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <CashBoxCard
        box={box}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!box.active} onClick={() => setMode("DEPOSIT")}>
              <ArrowDownToLine aria-hidden="true" />
              Depositar
            </Button>
            <Button size="sm" variant="outline" disabled={!box.active} onClick={() => setMode("WITHDRAWAL")}>
              <ArrowUpFromLine aria-hidden="true" />
              Retirar
            </Button>
            <Button size="sm" variant="outline" disabled={!box.active} onClick={() => setMode("TRANSFER")}>
              <ArrowLeftRight aria-hidden="true" />
              Trasladar
            </Button>
            <Button size="sm" variant="outline" disabled={!box.active} onClick={() => setMode("ADJUSTMENT")}>
              <Scale aria-hidden="true" />
              Ajustar
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Préstamos de esta caja</CardTitle>
          <CardDescription>Dinero que salió de aquí y todavía está en la calle o ya volvió.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={loanColumns}
            rows={box.loans}
            getRowId={(loan) => loan.id}
            renderCard={(loan) => (
              <MobileCard
                title={loan.personName}
                subtitle={formatDate(loan.startDate)}
                value={<MoneyDisplay value={loan.principalBalance} />}
                badge={<LoanStatusBadge status={loan.status} />}
                href={`/prestamos/${loan.id}`}
                meta={[{ label: "Capital", value: <MoneyDisplay value={loan.principalAmount} /> }]}
              />
            )}
            emptyState={
              <EmptyState
                icon={HandCoins}
                title="Sin préstamos"
                description="Los préstamos que crees eligiendo esta caja aparecerán aquí."
                className="py-6"
              />
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
          <CardDescription>Todo lo que ha entrado y salido, con el saldo después de cada movimiento.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={movementColumns}
            rows={box.movements}
            getRowId={(m) => m.id}
            renderCard={(m) => (
              <MobileCard
                title={m.description}
                subtitle={`${formatDate(m.movementDate)} · ${movementContext(m)}`}
                value={<MoneyDisplay value={m.amount} tone={m.amount < 0 ? "negative" : "positive"} signed />}
                badge={
                  <StatusBadge tone={m.amount < 0 ? "danger" : "success"}>
                    {CASH_BOX_MOVEMENT_KIND_LABELS[m.kind]}
                  </StatusBadge>
                }
                meta={[{ label: "Saldo", value: <MoneyDisplay value={m.balance} /> }]}
              />
            )}
            emptyState={
              <EmptyState icon={History} title="Sin movimientos" description="Deposita capital para empezar." className="py-6" />
            }
          />
        </CardContent>
      </Card>

      <CashBoxMovementDialog
        open={Boolean(mode)}
        onOpenChange={(open) => !open && setMode(null)}
        mode={mode ?? "DEPOSIT"}
        box={box}
        otherBoxes={options.filter((option) => option.id !== box.id)}
      />
    </div>
  );
}
