import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LoanForm } from "@/components/loans/loan-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getString } from "@/lib/search-params";
import { listActivePeopleOptions } from "@/server/queries/people";

export const metadata: Metadata = { title: "Nuevo préstamo" };

export default async function NewLoanPage({ searchParams }: PageProps<"/prestamos/nuevo">) {
  const params = await searchParams;
  const personId = getString(params, "personId");
  const people = await listActivePeopleOptions();

  return (
    <>
      <PageHeader
        title="Nuevo préstamo"
        description="Define las condiciones; las cuotas se generan automáticamente al guardar."
        backHref="/prestamos"
        backLabel="Préstamos"
      />
      {people.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Primero necesitas una persona activa"
          description="Registra a quién le vas a prestar antes de crear el préstamo."
          action={
            <Button asChild size="sm">
              <Link href="/personas">Ir a personas</Link>
            </Button>
          }
        />
      ) : (
        <LoanForm people={people} defaultPersonId={personId} />
      )}
    </>
  );
}
