import type { Metadata } from "next";

import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { INTEREST_TYPE_LABELS } from "@/lib/labels";
import { requireSession } from "@/server/auth";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const user = await requireSession();

  return (
    <>
      <PageHeader title="Configuración" description="Tu cuenta de administrador y las reglas del sistema." />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm user={{ name: user.name, email: user.email }} />
        <PasswordForm />
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reglas financieras</CardTitle>
            <CardDescription>Cómo calcula Capitalia los intereses y aplica los pagos.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium">Tipo de interés</dt>
                <dd className="text-muted-foreground">
                  {INTEREST_TYPE_LABELS.SIMPLE}: cada cuota cobra capital × tasa mensual × meses del periodo. El
                  capital se reparte en partes iguales y el residuo va a la última cuota.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Periodos</dt>
                <dd className="text-muted-foreground">
                  Mensual = 1 mes, quincenal = 15 días (0,5 meses), semanal = 7 días (0,25 meses), personalizada =
                  días / 30.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Aplicación de pagos</dt>
                <dd className="text-muted-foreground">
                  Cuota por cuota, primero al interés pendiente y luego al capital; el sobrante pasa a la siguiente
                  cuota. Un pago nunca puede superar el saldo del préstamo.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Estados</dt>
                <dd className="text-muted-foreground">
                  Una cuota vence cuando pasa su fecha sin quedar pagada; un préstamo queda vencido si tiene alguna
                  cuota vencida y pagado cuando todas sus cuotas lo están.
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
