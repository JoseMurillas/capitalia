"use client";

import { DateRangePicker } from "@/components/shared/date-range-picker";
import { TablePagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import type { PaymentDto } from "@/server/queries/loan-dto";
import type { LoanOption } from "@/server/queries/loans";
import type { PaymentListTotals } from "@/server/queries/payments";
import type { PaginatedResult } from "@/types";

import { PaymentsTable } from "./payments-table";
import { RegisterPaymentButton } from "./register-payment-button";

type PaymentsListProps = {
  result: PaginatedResult<PaymentDto> & { totals: PaymentListTotals };
  openLoans: LoanOption[];
  hasFilters: boolean;
};

export function PaymentsList({ result, openLoans, hasFilters }: PaymentsListProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Buscar por persona" />
        <DateRangePicker />
        <div className="sm:ml-auto">
          <RegisterPaymentButton loans={openLoans} />
        </div>
      </div>

      <PaymentsTable
        payments={result.items}
        emptyTitle={hasFilters ? "Sin pagos en este filtro" : "Aún no hay pagos"}
        emptyDescription={
          hasFilters
            ? "Prueba con otro rango de fechas o persona."
            : "Registra el primer abono de un préstamo activo."
        }
        emptyAction={
          hasFilters || openLoans.length === 0 ? null : <RegisterPaymentButton loans={openLoans} size="sm" />
        }
      />

      <TablePagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={result.pageSize}
        itemLabel="pagos"
      />
    </div>
  );
}
