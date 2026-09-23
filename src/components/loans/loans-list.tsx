"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { TablePagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUrlParams } from "@/hooks/use-url-params";
import type { CashBoxOption } from "@/server/queries/cash-boxes";
import type { LoanSummaryDto } from "@/server/queries/loan-dto";
import type { LoanListCounts, LoanStatusFilter } from "@/server/queries/loans";
import type { PaginatedResult } from "@/types";

import { LoansTable } from "./loans-table";

type LoansListProps = {
  result: PaginatedResult<LoanSummaryDto> & { counts: LoanListCounts };
  status: LoanStatusFilter;
  query?: string;
  cashBoxes: CashBoxOption[];
  cashBoxId?: string;
};

const TABS: { value: LoanStatusFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "ACTIVE", label: "Activos" },
  { value: "PAID", label: "Pagados" },
  { value: "OVERDUE", label: "Vencidos" },
  { value: "CANCELLED", label: "Cancelados" },
];

export function LoansList({ result, status, query, cashBoxes, cashBoxId }: LoansListProps) {
  const { setParams } = useUrlParams();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={status}
          onValueChange={(value) => setParams({ status: value === "ALL" ? null : value }, { resetPage: true })}
        >
          <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="shrink-0">
                {tab.label}
                <span className="ml-1 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                  {result.counts[tab.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput placeholder="Buscar por persona o documento" />
          <Select
            value={cashBoxId ?? "all"}
            onValueChange={(value) => setParams({ cashBox: value === "all" ? null : value }, { resetPage: true })}
          >
            <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por caja">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cajas</SelectItem>
              {cashBoxes.map((box) => (
                <SelectItem key={box.id} value={box.id}>
                  {box.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/prestamos/nuevo">
              <Plus aria-hidden="true" />
              Nuevo préstamo
            </Link>
          </Button>
        </div>
      </div>

      <LoansTable
        loans={result.items}
        emptyTitle={query || status !== "ALL" ? "Sin resultados" : "Aún no hay préstamos"}
        emptyDescription={
          query || status !== "ALL"
            ? "Cambia el filtro o la búsqueda."
            : "Crea el primer préstamo para empezar a llevar el control."
        }
        showCreateAction={!query && status === "ALL"}
      />

      <TablePagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={result.pageSize}
        itemLabel="préstamos"
      />
    </div>
  );
}
