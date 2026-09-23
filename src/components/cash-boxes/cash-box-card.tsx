import { PiggyBank } from "lucide-react";
import Link from "next/link";

import { MoneyDisplay } from "@/components/shared/money-display";
import { ActiveBadge } from "@/components/shared/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CashBoxDto } from "@/server/queries/cash-boxes";

type CashBoxCardProps = {
  box: CashBoxDto;
  /** Dropdown or buttons rendered top-right. */
  actions?: React.ReactNode;
  /** When set, the name links to the detail page. */
  href?: string;
};

/** Where this fund's money is: ready to lend, out in loans, and the total. */
export function CashBoxCard({ box, actions, href }: CashBoxCardProps) {
  const title = href ? (
    <Link href={href} className="hover:underline">
      {box.name}
    </Link>
  ) : (
    box.name
  );

  return (
    <Card className={cn(!box.active && "opacity-70")}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <PiggyBank className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{title}</span>
          {box.active ? null : <ActiveBadge active={false} />}
        </CardTitle>
        <CardDescription className="text-xs">
          {box.description ? `${box.description} · ` : ""}
          {box.activeLoans} {box.activeLoans === 1 ? "préstamo activo" : "préstamos activos"}
        </CardDescription>
        {actions ? <CardAction>{actions}</CardAction> : null}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Disponible</dt>
            <dd className="text-lg font-semibold">
              <MoneyDisplay value={box.available} tone={box.available > 0 ? "positive" : "muted"} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Prestado</dt>
            <dd className="font-medium">
              <MoneyDisplay value={box.lentOut} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Capital total</dt>
            <dd className="font-medium">
              <MoneyDisplay value={box.total} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Intereses ganados</dt>
            <dd className="font-medium">
              <MoneyDisplay value={box.interestEarned} tone="positive" />
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
