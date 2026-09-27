import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccountDetail } from "@/components/accounts/account-detail";
import { PageHeader } from "@/components/shared/page-header";
import { getAccount } from "@/server/queries/accounts";

export async function generateMetadata({ params }: PageProps<"/finanzas/cuentas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const account = await getAccount(id);
  return { title: account ? `Cuenta · ${account.name}` : "Cuenta" };
}

export default async function AccountDetailPage({ params }: PageProps<"/finanzas/cuentas/[id]">) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  return (
    <>
      <PageHeader
        title={account.name}
        description="Saldo e historial completo de esta cuenta."
        backHref="/finanzas/cuentas"
        backLabel="Cuentas"
      />
      <AccountDetail account={account} />
    </>
  );
}
