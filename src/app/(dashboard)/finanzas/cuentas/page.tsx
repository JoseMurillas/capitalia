import type { Metadata } from "next";

import { AccountsList } from "@/components/accounts/accounts-list";
import { FinanceNav } from "@/components/finance/finance-nav";
import { PageHeader } from "@/components/shared/page-header";
import { getAccountsSummary, listAccounts } from "@/server/queries/accounts";
import { countPendingInbox } from "@/server/queries/inbox";

export const metadata: Metadata = { title: "Cuentas" };

export default async function AccountsPage() {
  const [accounts, summary, pendingInbox] = await Promise.all([
    listAccounts(),
    getAccountsSummary(),
    countPendingInbox(),
  ]);

  return (
    <>
      <PageHeader
        title="Cuentas"
        description="Dónde está tu plata: el saldo de cada una es la suma de lo que pasó por ella."
      />
      <FinanceNav pendingInbox={pendingInbox} />
      <AccountsList accounts={accounts} summary={summary} />
    </>
  );
}
