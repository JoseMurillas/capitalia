import type { Metadata } from "next";

import { PeopleList } from "@/components/people/people-list";
import { PageHeader } from "@/components/shared/page-header";
import { getEnum, getPage, getString } from "@/lib/search-params";
import { listPeople } from "@/server/queries/people";

export const metadata: Metadata = { title: "Personas" };

const STATUS_FILTERS = ["active", "inactive", "all"] as const;

export default async function PeoplePage({ searchParams }: PageProps<"/personas">) {
  const params = await searchParams;
  const q = getString(params, "q");
  const status = getEnum(params, "status", STATUS_FILTERS) ?? "all";
  const page = getPage(params);

  const result = await listPeople({ q, status, page });

  return (
    <>
      <PageHeader
        title="Personas"
        description="Clientes a quienes les prestas dinero y su saldo pendiente."
      />
      <PeopleList result={result} query={q} status={status} />
    </>
  );
}
