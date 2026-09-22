import { CreditCard as CreditCardIcon } from "lucide-react";
import Link from "next/link";

import { MoneyDisplay } from "@/components/shared/money-display";
import { ActiveBadge, CommitmentStatusBadge } from "@/components/shared/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { dueInLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { CreditCardDto } from "@/server/queries/credit-cards";

import { UtilizationBar } from "./utilization-bar";

type CreditCardCardProps = {
  card: CreditCardDto;
  /** Dropdown or buttons rendered top-right. */
  actions?: React.ReactNode;
  /** When set, the card name links to the detail page. */
  href?: string;
};

/** Everything the user wants to know about one card at a glance. */
export function CreditCardCard({ card, actions, href }: CreditCardCardProps) {
  const overLimit = card.balance > card.creditLimit;
  const title = href ? (
    <Link href={href} className="hover:underline">
      {card.name}
    </Link>
  ) : (
    card.name
  );

  return (
    <Card className={cn(!card.active && "opacity-70")}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <CreditCardIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{title}</span>
          {card.active ? <CommitmentStatusBadge status={card.status} /> : <ActiveBadge active={false} />}
        </CardTitle>
        <CardDescription className="text-xs">
          Corte {formatDate(card.nextClosingDate)} · Límite de pago {formatDate(card.nextPaymentDate)} ·{" "}
          {dueInLabel(card.daysUntilPayment)}
        </CardDescription>
        {actions ? <CardAction>{actions}</CardAction> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Utilización</span>
            <span className={cn("tabular-nums", overLimit && "font-medium text-red-600 dark:text-red-400")}>
              <MoneyDisplay value={card.balance} /> de <MoneyDisplay value={card.creditLimit} />
            </span>
          </div>
          <UtilizationBar value={card.utilization} className="mt-1.5" />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Disponible</dt>
            <dd className="font-medium">
              <MoneyDisplay value={card.available} tone={card.available === 0 ? "negative" : "positive"} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Próximo pago</dt>
            <dd className="font-semibold">
              <MoneyDisplay value={card.suggestedPayment} />
              {card.paymentAmount === null && card.minimumPayment !== null ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(mínimo)</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pago mínimo</dt>
            <dd className="font-medium">
              {card.minimumPayment === null ? <span className="text-muted-foreground">—</span> : <MoneyDisplay value={card.minimumPayment} />}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Saldo pendiente</dt>
            <dd className="font-medium">
              <MoneyDisplay value={card.balance} tone={card.balance > 0 ? "negative" : "neutral"} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Cuotas del mes</dt>
            <dd className="font-medium">
              {card.activePlans === 0 ? (
                <span className="text-muted-foreground">Sin compras diferidas</span>
              ) : (
                <>
                  <MoneyDisplay value={card.installmentsThisMonth} />
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({card.activePlans} {card.activePlans === 1 ? "compra" : "compras"})
                  </span>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Aviso</dt>
            <dd className="font-medium">{card.reminderDays === 0 ? "El mismo día" : `${card.reminderDays} días antes`}</dd>
          </div>
        </dl>
        {card.notes ? <p className="text-xs text-muted-foreground">{card.notes}</p> : null}
      </CardContent>
    </Card>
  );
}
