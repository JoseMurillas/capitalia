import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CreditCardDetail } from "@/components/finance/cards/credit-card-detail";
import { PageHeader } from "@/components/shared/page-header";
import { getCreditCardDetail } from "@/server/queries/credit-cards";
import { getDefaultReminderDays } from "@/server/services/settings";

export const metadata: Metadata = { title: "Tarjeta de crédito" };

export default async function CreditCardDetailPage({ params }: PageProps<"/finanzas/tarjetas/[id]">) {
  const { id } = await params;
  const [card, defaultReminderDays] = await Promise.all([getCreditCardDetail(id), getDefaultReminderDays()]);
  if (!card) notFound();

  return (
    <>
      <PageHeader
        title={card.name}
        description="Detalle de la tarjeta: cupo, compras diferidas e historial."
        backHref="/finanzas/tarjetas"
        backLabel="Tarjetas"
      />
      <CreditCardDetail card={card} defaultReminderDays={defaultReminderDays} />
    </>
  );
}
