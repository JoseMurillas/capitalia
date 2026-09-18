import { Banknote, CalendarClock, HandCoins, Percent, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InstallmentsTable } from "@/components/loans/installments-table";
import { LoanActions } from "@/components/loans/loan-actions";
import { PaymentsTable } from "@/components/payments/payments-table";
import { RegisterPaymentButton } from "@/components/payments/register-payment-button";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { InstallmentStatusBadge, LoanStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateLong } from "@/lib/dates";
import { formatPercent } from "@/lib/format";
import { FREQUENCY_LABELS, INTEREST_TYPE_LABELS } from "@/lib/labels";
import { getLoanDetail } from "@/server/queries/loans";

export async function generateMetadata({ params }: PageProps<"/prestamos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const loan = await getLoanDetail(id);
  return { title: loan ? `Préstamo · ${loan.personName}` : "Préstamo" };
}

export default async function LoanDetailPage({ params }: PageProps<"/prestamos/[id]">) {
  const { id } = await params;
  const loan = await getLoanDetail(id);
  if (!loan) notFound();

  const isOpen = loan.status === "ACTIVE" || loan.status === "OVERDUE";
  const progress = loan.totalAmount > 0 ? Math.min(100, Math.round((loan.totalPaid / loan.totalAmount) * 100)) : 0;

  return (
    <>
      <PageHeader
        title={`Préstamo a ${loan.personName}`}
        description={`Iniciado el ${formatDateLong(loan.startDate)} · ${loan.numberOfInstallments} cuota${
          loan.numberOfInstallments === 1 ? "" : "s"
        } ${FREQUENCY_LABELS[loan.installmentFrequency].toLowerCase()}${
          loan.installmentFrequency === "CUSTOM" && loan.customIntervalDays ? ` (cada ${loan.customIntervalDays} días)` : ""
        }`}
        backHref="/prestamos"
        backLabel="Préstamos"
        actions={
          <>
            <LoanStatusBadge status={loan.status} className="h-8 px-3" />
            <RegisterPaymentButton
              loans={[{ id: loan.id, personName: loan.personName, balance: loan.balance, installments: loan.installments }]}
              disabled={!isOpen}
            />
            <LoanActions loan={loan} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title="Capital inicial"
          value={<MoneyDisplay value={loan.principalAmount} />}
          icon={HandCoins}
          tone="info"
          hint={`${formatPercent(loan.monthlyInterestRate)} mensual · ${INTEREST_TYPE_LABELS[loan.interestType]}`}
        />
        <StatCard
          title="Total de intereses"
          value={<MoneyDisplay value={loan.totalInterest} />}
          icon={Percent}
          tone="positive"
          hint={
            <>
              Cobrados: <MoneyDisplay value={loan.interestPaid} /> · Saldo:{" "}
              <MoneyDisplay value={loan.interestBalance} />
            </>
          }
        />
        <StatCard
          title="Total pagado"
          value={<MoneyDisplay value={loan.totalPaid} />}
          icon={Banknote}
          tone="positive"
          hint={
            <>
              Capital: <MoneyDisplay value={loan.principalPaid} /> · {progress}% del total
            </>
          }
        />
        <StatCard
          title="Saldo pendiente"
          value={<MoneyDisplay value={loan.balance} />}
          icon={Wallet}
          tone={loan.balance > 0 ? "warning" : "default"}
          hint={
            <>
              Capital: <MoneyDisplay value={loan.principalBalance} /> · Interés:{" "}
              <MoneyDisplay value={loan.interestBalance} />
            </>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
              Próxima cuota
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loan.nextInstallment && isOpen ? (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cuota</span>
                  <span className="font-medium">#{loan.nextInstallment.installmentNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Vence</span>
                  <span>{formatDate(loan.nextInstallment.dueDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pendiente</span>
                  <MoneyDisplay value={loan.nextInstallment.pendingAmount} className="font-semibold" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estado</span>
                  <InstallmentStatusBadge status={loan.nextInstallment.status} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {loan.status === "PAID" ? "Todas las cuotas están pagadas." : "Sin cuotas pendientes."}
              </p>
            )}
            <dl className="mt-4 grid gap-2 border-t pt-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Vencimiento del préstamo</dt>
                <dd>{formatDate(loan.dueDate)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Cuotas pagadas</dt>
                <dd className="tabular-nums">
                  {loan.paidCount} / {loan.numberOfInstallments}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Persona</dt>
                <dd>
                  <Link href={`/personas/${loan.personId}`} className="font-medium hover:underline">
                    {loan.personName}
                  </Link>
                </dd>
              </div>
            </dl>
            {loan.notes ? (
              <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">{loan.notes}</p>
            ) : null}
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3 lg:col-span-2">
          <h2 className="text-lg font-semibold">Cuotas</h2>
          <InstallmentsTable installments={loan.installments} />
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pagos registrados</h2>
        <PaymentsTable
          payments={loan.payments}
          showPerson={false}
          emptyDescription={isOpen ? "Registra el primer abono con el botón «Registrar pago»." : undefined}
        />
      </section>
    </>
  );
}
