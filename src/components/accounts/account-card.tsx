import { Banknote, CreditCard, type LucideIcon, PiggyBank, Smartphone } from "lucide-react";
import Link from "next/link";

import { MoneyDisplay } from "@/components/shared/money-display";
import { ActiveBadge } from "@/components/shared/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCOUNT_KIND_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { AccountDto } from "@/server/queries/accounts";

/** One icon per kind, so a glance is enough to tell a wallet from a card. */
const KIND_ICONS: Record<AccountDto["kind"], LucideIcon> = {
  DEBIT: CreditCard,
  SAVINGS: PiggyBank,
  CASH: Banknote,
  WALLET: Smartphone,
};

type AccountCardProps = {
  account: AccountDto;
  /** Dropdown or buttons rendered top-right. */
  actions?: React.ReactNode;
  /** When set, the name links to the detail page. */
  href?: string;
};

/** How much this account holds right now: the sum of everything that passed through it. */
export function AccountCard({ account, actions, href }: AccountCardProps) {
  const Icon = KIND_ICONS[account.kind];
  // The issuer and the last digits are how you recognise the account in real life.
  const details = [account.issuer, account.last4 ? `•••• ${account.last4}` : null].filter(Boolean).join(" · ");
  const title = href ? (
    <Link href={href} className="hover:underline">
      {account.name}
    </Link>
  ) : (
    account.name
  );

  return (
    <Card className={cn("gap-3", !account.active && "opacity-70")}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{title}</span>
          {account.active ? null : <ActiveBadge active={false} />}
        </CardTitle>
        <CardDescription className="text-xs">
          {ACCOUNT_KIND_LABELS[account.kind]}
          {details ? ` · ${details}` : ""}
        </CardDescription>
        {actions ? <CardAction>{actions}</CardAction> : null}
      </CardHeader>
      <CardContent>
        <dl>
          <dt className="text-xs text-muted-foreground">Saldo</dt>
          <dd className="text-xl font-semibold">
            {/* A negative balance is shown, never blocked: the ledger may still be incomplete. */}
            <MoneyDisplay value={account.balance} tone={account.balance < 0 ? "negative" : "neutral"} />
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}
