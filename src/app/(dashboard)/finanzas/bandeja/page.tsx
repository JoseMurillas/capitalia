import type { Metadata } from "next";

import { InboxList } from "@/components/finance/inbox/inbox-list";
import { PageHeader } from "@/components/shared/page-header";
import { getEnum, getPage, getString } from "@/lib/search-params";
import { listInboxMessages } from "@/server/queries/inbox";

export const metadata: Metadata = { title: "Bandeja de correos del banco" };

const STATUSES = ["PENDING", "CONFIRMED", "DISCARDED"] as const;

export default async function InboxPage({ searchParams }: PageProps<"/finanzas/bandeja">) {
  const params = await searchParams;
  const status = getEnum(params, "status", STATUSES) ?? "PENDING";
  const q = getString(params, "q");
  const page = getPage(params);
  const result = await listInboxMessages({ status, q, page });

  return (
    <>
      <PageHeader
        title="Bandeja del banco"
        description="Correos de tu banco recibidos automáticamente. Confirma cada uno para convertirlo en ingreso o gasto."
        backHref="/finanzas"
        backLabel="Finanzas"
      />
      <InboxList result={result} status={status} query={q} />
    </>
  );
}
