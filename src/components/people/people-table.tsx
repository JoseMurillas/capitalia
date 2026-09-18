"use client";

import { Users } from "lucide-react";
import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileCard } from "@/components/shared/mobile-card";
import { MoneyDisplay } from "@/components/shared/money-display";
import { ActiveBadge } from "@/components/shared/status-badge";
import type { PersonListItem } from "@/server/queries/people";

import { PersonActions } from "./person-actions";

type PeopleTableProps = {
  people: PersonListItem[];
  hasFilters: boolean;
  onCreate: () => void;
};

function toActionsPerson(p: PersonListItem) {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    email: p.email,
    document: p.document,
    address: p.address,
    notes: p.notes,
    active: p.active,
  };
}

export function PeopleTable({ people, hasFilters, onCreate }: PeopleTableProps) {
  const columns: DataTableColumn<PersonListItem>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (p) => (
        <div className="min-w-0">
          <Link href={`/personas/${p.id}`} className="font-medium hover:underline">
            {p.name}
          </Link>
          {p.document ? <p className="text-xs text-muted-foreground">CC {p.document}</p> : null}
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contacto",
      className: "hidden md:table-cell",
      cell: (p) => (
        <div className="text-sm">
          <p>{p.phone ?? "—"}</p>
          {p.email ? <p className="text-xs text-muted-foreground">{p.email}</p> : null}
        </div>
      ),
    },
    {
      key: "loans",
      header: "Préstamos activos",
      className: "text-center hidden sm:table-cell",
      cell: (p) => <span className="tabular-nums">{p.activeLoans}</span>,
    },
    {
      key: "balance",
      header: "Saldo pendiente",
      className: "text-right",
      cell: (p) => <MoneyDisplay value={p.balance} tone={p.balance > 0 ? "neutral" : "muted"} />,
    },
    {
      key: "status",
      header: "Estado",
      cell: (p) => <ActiveBadge active={p.active} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-12 text-right",
      cell: (p) => <PersonActions person={toActionsPerson(p)} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={people}
      getRowId={(p) => p.id}
      renderCard={(p) => (
        <MobileCard
          href={`/personas/${p.id}`}
          title={p.name}
          subtitle={[p.document ? `CC ${p.document}` : null, p.phone].filter(Boolean).join(" · ") || "Sin contacto"}
          value={<MoneyDisplay value={p.balance} tone={p.balance > 0 ? "neutral" : "muted"} />}
          badge={<ActiveBadge active={p.active} />}
          meta={[
            { label: "Préstamos activos", value: p.activeLoans },
            { label: "Saldo pendiente", value: <MoneyDisplay value={p.balance} /> },
          ]}
          actions={<PersonActions person={toActionsPerson(p)} />}
        />
      )}
      emptyState={
        <EmptyState
          icon={Users}
          title={hasFilters ? "Sin resultados" : "Aún no hay personas"}
          description={
            hasFilters
              ? "Prueba con otro nombre, documento o teléfono."
              : "Registra a las personas a las que les prestas dinero."
          }
          action={
            hasFilters ? null : (
              <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={onCreate}>
                Crear la primera persona
              </button>
            )
          }
        />
      }
    />
  );
}
