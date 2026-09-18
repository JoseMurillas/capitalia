"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { TablePagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUrlParams } from "@/hooks/use-url-params";
import type { PersonListItem, PersonStatusFilter } from "@/server/queries/people";
import type { PaginatedResult } from "@/types";

import { PeopleTable } from "./people-table";
import { PersonFormDialog } from "./person-form-dialog";

type PeopleListProps = {
  result: PaginatedResult<PersonListItem>;
  query?: string;
  status: PersonStatusFilter;
};

const STATUS_OPTIONS: { value: PersonStatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Activas" },
  { value: "inactive", label: "Inactivas" },
];

export function PeopleList({ result, query, status }: PeopleListProps) {
  const { setParams } = useUrlParams();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Buscar por nombre, documento o teléfono" />
        <Select
          value={status}
          onValueChange={(value) => setParams({ status: value === "all" ? null : value }, { resetPage: true })}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="sm:ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden="true" />
          Nueva persona
        </Button>
      </div>

      <PeopleTable
        people={result.items}
        hasFilters={Boolean(query) || status !== "all"}
        onCreate={() => setCreateOpen(true)}
      />

      <TablePagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={result.pageSize}
        itemLabel="personas"
      />

      <PersonFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
