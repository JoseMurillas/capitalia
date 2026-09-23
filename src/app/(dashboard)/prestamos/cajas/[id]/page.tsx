import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CashBoxDetail } from "@/components/cash-boxes/cash-box-detail";
import { PageHeader } from "@/components/shared/page-header";
import { CASH_BOX_MOVEMENT_KINDS } from "@/lib/validations/cash-box";
import { getEnum, getIsoDate } from "@/lib/search-params";
import { getCashBoxDetail, listCashBoxOptions } from "@/server/queries/cash-boxes";

export async function generateMetadata({ params }: PageProps<"/prestamos/cajas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const box = await getCashBoxDetail(id);
  return { title: box ? `Caja · ${box.name}` : "Caja" };
}

export default async function CashBoxDetailPage({ params, searchParams }: PageProps<"/prestamos/cajas/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const kind = getEnum(query, "kind", CASH_BOX_MOVEMENT_KINDS);
  const from = getIsoDate(query, "from");
  const to = getIsoDate(query, "to");

  const [box, options] = await Promise.all([getCashBoxDetail(id, { kind, from, to }), listCashBoxOptions()]);
  if (!box) notFound();

  return (
    <>
      <PageHeader
        title={box.name}
        description="Capital, préstamos e historial completo de esta caja."
        backHref="/prestamos/cajas"
        backLabel="Cajas"
      />
      <CashBoxDetail box={box} options={options} kind={kind} hasDateFilter={Boolean(from || to)} />
    </>
  );
}
