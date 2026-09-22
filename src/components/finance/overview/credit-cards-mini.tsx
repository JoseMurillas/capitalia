import { CreditCard } from "lucide-react";
import Link from "next/link";

import { UtilizationBar } from "@/components/finance/cards/utilization-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import type { CreditCardDto } from "@/server/queries/credit-cards";

export function CreditCardsMini({ cards }: { cards: CreditCardDto[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarjetas de crédito</CardTitle>
        <CardDescription>Cupo usado y próximo pago. El cupo no es dinero disponible.</CardDescription>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <EmptyState icon={CreditCard} title="Sin tarjetas" description="Regístralas en Finanzas → Tarjetas." className="border-0 py-6" />
        ) : (
          <ul className="flex flex-col gap-4">
            {cards.map((card) => (
              <li key={card.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={`/finanzas/tarjetas/${card.id}`} className="truncate font-medium hover:underline">
                    {card.name}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Disponible <MoneyDisplay value={card.available} />
                  </span>
                </div>
                <UtilizationBar value={card.utilization} className="mt-1.5" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Próximo pago <MoneyDisplay value={card.suggestedPayment} className="font-medium text-foreground" /> ·{" "}
                  {formatDate(card.nextPaymentDate)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
