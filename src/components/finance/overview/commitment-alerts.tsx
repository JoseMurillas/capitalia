"use client";

import { AlertTriangle, BellRing, CreditCard, Repeat } from "lucide-react";
import { useState } from "react";

import { CardPaymentDialog, type CardPaymentTarget } from "@/components/finance/cards/card-payment-dialog";
import { MarkPaidDialog, type MarkPaidTarget } from "@/components/finance/recurring/mark-paid-dialog";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { dueInLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { CommitmentDto } from "@/server/queries/commitments";

/** "🔔 Próximo pago: Internet · Vence en 3 días · $120.000" with a Pagar shortcut. */
export function CommitmentAlerts({ alerts }: { alerts: CommitmentDto[] }) {
  const [paying, setPaying] = useState<MarkPaidTarget | null>(null);
  const [payingCard, setPayingCard] = useState<CardPaymentTarget | null>(null);

  if (alerts.length === 0) return null;

  const overdue = alerts.filter((a) => a.status === "OVERDUE").length;

  return (
    <Card className={cn("border-amber-300/70 dark:border-amber-700/60", overdue > 0 && "border-red-300/70 dark:border-red-800/60")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          Alertas de pago
        </CardTitle>
        <CardDescription>
          {alerts.length} {alerts.length === 1 ? "compromiso" : "compromisos"} dentro de su ventana de aviso
          {overdue > 0 ? ` · ${overdue} ${overdue === 1 ? "vencido" : "vencidos"}` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {alerts.map((a) => {
            const late = a.status === "OVERDUE" || a.status === "DUE_TODAY";
            return (
              <li key={`${a.kind}-${a.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    late ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
                  )}
                >
                  {late ? <AlertTriangle className="size-4" aria-hidden="true" /> : a.kind === "CARD" ? <CreditCard className="size-4" aria-hidden="true" /> : <Repeat className="size-4" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {a.kind === "CARD" ? "Tarjeta " : ""}
                    {a.name}
                  </p>
                  <p className={cn("text-xs", late ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                    {dueInLabel(a.daysUntilDue)} · {formatDate(a.dueDate)}
                    {a.kind === "RECURRING" && a.paymentMethod === "CREDIT_CARD" && a.creditCardName ? ` · con ${a.creditCardName}` : ""}
                  </p>
                </div>
                <MoneyDisplay value={a.amount} className="shrink-0 font-semibold" />
                <Button
                  size="sm"
                  variant={late ? "default" : "outline"}
                  className="shrink-0"
                  aria-label={`Pagar ${a.kind === "CARD" ? "tarjeta " : ""}${a.name}`}
                  onClick={() => (a.kind === "CARD" ? setPayingCard(a) : setPaying(a))}
                >
                  Pagar
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>

      <MarkPaidDialog open={Boolean(paying)} onOpenChange={(open) => !open && setPaying(null)} target={paying} />
      <CardPaymentDialog open={Boolean(payingCard)} onOpenChange={(open) => !open && setPayingCard(null)} card={payingCard} />
    </Card>
  );
}
