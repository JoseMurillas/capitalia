"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatNumber } from "@/lib/format";

type TablePaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  itemLabel?: string;
};

/** Page navigation bound to the `page` URL parameter. */
export function TablePagination({
  page,
  pageCount,
  total,
  pageSize,
  itemLabel = "registros",
}: TablePaginationProps) {
  const { setParams } = useUrlParams();
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
      <p>
        Mostrando {formatNumber(from)}–{formatNumber(to)} de {formatNumber(total)} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setParams({ page: page - 1 <= 1 ? null : page - 1 })}
        >
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
        <span className="px-1 tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => setParams({ page: page + 1 })}
        >
          Siguiente
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
