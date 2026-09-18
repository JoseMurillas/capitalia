import { Banknote, HandCoins, Percent, PiggyBank, Plus, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LoansTable } from "@/components/loans/loans-table";
import { PaymentsTable } from "@/components/payments/payments-table";
import { PersonActions } from "@/components/people/person-actions";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ActiveBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { getPersonDetail } from "@/server/queries/people";

export async function generateMetadata({ params }: PageProps<"/personas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const person = await getPersonDetail(id);
  return { title: person ? person.name : "Persona" };
}

export default async function PersonDetailPage({ params }: PageProps<"/personas/[id]">) {
  const { id } = await params;
  const person = await getPersonDetail(id);
  if (!person) notFound();

  const { totals } = person;

  return (
    <>
      <PageHeader
        title={person.name}
        description={person.document ? `Documento ${person.document}` : undefined}
        backHref="/personas"
        backLabel="Personas"
        actions={
          <>
            <ActiveBadge active={person.active} className="h-8 px-3" />
            {person.active ? (
              <Button asChild>
                <Link href={`/prestamos/nuevo?personId=${person.id}`}>
                  <Plus aria-hidden="true" />
                  Nuevo préstamo
                </Link>
              </Button>
            ) : null}
            <PersonActions person={person} showView={false} redirectAfterDelete triggerVariant="button" />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total prestado"
          value={<MoneyDisplay value={totals.totalLent} />}
          icon={HandCoins}
          tone="info"
          hint={`${totals.activeLoans} préstamo${totals.activeLoans === 1 ? "" : "s"} activo${totals.activeLoans === 1 ? "" : "s"}`}
        />
        <StatCard
          title="Total pagado"
          value={<MoneyDisplay value={totals.totalPaid} />}
          icon={Banknote}
          tone="positive"
        />
        <StatCard
          title="Saldo pendiente"
          value={<MoneyDisplay value={totals.balance} />}
          icon={Wallet}
          tone={totals.balance > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Intereses generados"
          value={<MoneyDisplay value={totals.interestGenerated} />}
          icon={Percent}
          tone="positive"
          hint={
            <span className="inline-flex items-center gap-1">
              <PiggyBank className="size-3" aria-hidden="true" />
              Cobrados: <MoneyDisplay value={totals.interestCollected} />
            </span>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              <InfoRow label="Teléfono" value={person.phone} />
              <InfoRow label="Correo" value={person.email} />
              <InfoRow label="Dirección" value={person.address} />
              <InfoRow label="Notas" value={person.notes} />
              <InfoRow label="Registrada" value={formatDateTime(new Date(person.createdAt))} />
            </dl>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Préstamos</h2>
            <LoansTable
              loans={person.loans}
              showPerson={false}
              emptyTitle="Sin préstamos"
              emptyDescription="Esta persona aún no tiene préstamos registrados."
              showCreateAction={person.active}
            />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Historial de pagos</h2>
            <PaymentsTable payments={person.payments} showPerson={false} />
          </section>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value || "—"}</dd>
    </div>
  );
}
