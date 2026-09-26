"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BellRing, Copy } from "lucide-react";
import { useTransition } from "react";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FormItem } from "@/components/shared/form-item";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { handleActionFailure } from "@/lib/forms";
import { type ReminderSettingsInput, reminderSettingsSchema } from "@/lib/validations/reminder";
import { updateReminderSettingsAction } from "@/server/actions/settings";
import type { ReminderSettings } from "@/server/services/settings";

type ReminderSetupCardProps = {
  settings: ReminderSettings;
  /** Whether SMTP_USER and SMTP_PASSWORD are set on the server. */
  mailerReady: boolean;
  /** Absolute URL of /api/recordatorios, built on the server from the request host. */
  endpointUrl: string;
};

/** The contact is plain text in the form; the schema turns an empty one into null. */
type ReminderFormValues = { enabled: boolean; signature: string; contact: string };

export function ReminderSetupCard({ settings, mailerReady, endpointUrl }: ReminderSetupCardProps) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<ReminderFormValues, unknown, ReminderSettingsInput>({
    resolver: zodResolver(reminderSettingsSchema) as Resolver<ReminderFormValues, unknown, ReminderSettingsInput>,
    defaultValues: {
      enabled: settings.enabled,
      signature: settings.signature,
      contact: settings.contact ?? "",
    },
  });

  const onSubmit = form.handleSubmit(
    (values) => {
      startTransition(async () => {
        const result = await updateReminderSettingsAction(values);
        if (handleActionFailure(form, result)) {
          // The switch saves on the spot, so a rejected save has to put it back:
          // a toggle left flipped says "guardado" when nothing was stored.
          form.resetField("enabled");
          return;
        }
        toast.success(values.enabled ? "Recordatorios activados" : "Recordatorios pausados");
        // Re-baseline to what was actually sent, not to what is in the inputs
        // now: text typed while the request was in flight is still unsaved.
        form.reset({ enabled: values.enabled, signature: values.signature, contact: values.contact ?? "" });
      });
    },
    () => {
      // Validation stopped the save before it left the browser.
      form.resetField("enabled");
    },
  );

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(endpointUrl);
      toast.success("URL copiada");
    } catch {
      toast.error("No se pudo copiar; selecciona el texto y cópialo manualmente");
    }
  };

  const { errors, isDirty } = form.formState;
  const enabled = useWatch({ control: form.control, name: "enabled" });

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
          Recordatorios de pago
          {enabled ? <StatusBadge tone="success">Activos</StatusBadge> : <StatusBadge tone="neutral">Pausados</StatusBadge>}
          {mailerReady ? (
            <StatusBadge tone="neutral">Correo configurado</StatusBadge>
          ) : (
            <StatusBadge tone="warning">Correo en modo de prueba</StatusBadge>
          )}
        </CardTitle>
        <CardDescription>
          Un correo el día antes de que venza cada cuota y, si no se paga, otro al día siguiente y cada semana. Salen
          desde una cuenta de solo envío; el deudor no puede responderlos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          {/* The switch saves on the spot: nobody expects to press "Guardar" after flipping a toggle. */}
          <Controller
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch
                  id="reminders-enabled"
                  checked={field.value}
                  disabled={isPending}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    void onSubmit();
                  }}
                />
                <FieldLabel htmlFor="reminders-enabled">Enviar recordatorios automáticamente</FieldLabel>
              </Field>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormItem
              label="Firma de los correos"
              htmlFor="reminder-signature"
              error={errors.signature}
              description="Con este nombre se despiden los recordatorios."
            >
              <Input
                id="reminder-signature"
                maxLength={80}
                aria-invalid={Boolean(errors.signature)}
                {...form.register("signature")}
              />
            </FormItem>
            <FormItem
              label="Contacto (opcional)"
              htmlFor="reminder-contact"
              error={errors.contact}
              description="Teléfono o WhatsApp que se ofrece en el correo. Vacío = no se menciona."
            >
              <Input
                id="reminder-contact"
                maxLength={80}
                placeholder="3001234567"
                aria-invalid={Boolean(errors.contact)}
                {...form.register("contact")}
              />
            </FormItem>
            <div className="sm:col-span-2">
              <Button type="submit" variant="outline" disabled={isPending || !isDirty}>
                {isPending ? <Spinner /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </form>

        <ol className="grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-lg border p-3">
            <p className="font-medium">1. Cuenta de envío</p>
            <p className="mt-1 text-muted-foreground">
              En la cuenta de solo envío activa la verificación en dos pasos y crea una{" "}
              <em>contraseña de aplicación</em>.
            </p>
          </li>
          <li className="rounded-lg border p-3">
            <p className="font-medium">2. Variables</p>
            <p className="mt-1 text-muted-foreground">
              Define <code className="rounded bg-muted px-1">SMTP_USER</code> y{" "}
              <code className="rounded bg-muted px-1">SMTP_PASSWORD</code> en el entorno (en Vercel, en Settings →
              Environment Variables). Sin ellas, fuera de producción los correos solo se escriben en el log; en
              producción la corrida se detiene con un error y no envía nada.
            </p>
          </li>
          <li className="rounded-lg border p-3">
            <p className="font-medium">3. Envío diario</p>
            <p className="mt-1 text-muted-foreground">
              El <code className="rounded bg-muted px-1">vercel.json</code> del proyecto ya llama a este endpoint cada
              día a las 8 a. m. Define también <code className="rounded bg-muted px-1">CRON_SECRET</code>.
            </p>
          </li>
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <code className="truncate rounded bg-muted px-2 py-1 text-xs">{endpointUrl}</code>
          <Button type="button" variant="ghost" size="sm" onClick={copyUrl}>
            <Copy aria-hidden="true" />
            Copiar URL
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
