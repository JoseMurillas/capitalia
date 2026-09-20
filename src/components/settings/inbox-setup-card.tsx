"use client";

import { Check, Copy, KeyRound, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { buildGmailScript } from "@/lib/inbox/gmail-script";
import { rotateInboxTokenAction } from "@/server/actions/settings";

type InboxSetupCardProps = {
  endpointUrl: string;
  hasToken: boolean;
};

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("No se pudo copiar; selecciona el texto y cópialo manualmente");
  }
}

export function InboxSetupCard({ endpointUrl, hasToken }: InboxSetupCardProps) {
  const [token, setToken] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const generate = () =>
    startTransition(async () => {
      const result = await rotateInboxTokenAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setToken(result.data.token);
      toast.success("Clave generada. Cópiala ahora: no se volverá a mostrar.");
    });

  const script = token ? buildGmailScript(endpointUrl, token) : null;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
          Bandeja del banco
          {hasToken || token ? <StatusBadge tone="success">Configurada</StatusBadge> : <StatusBadge tone="neutral">Sin configurar</StatusBadge>}
        </CardTitle>
        <CardDescription>
          Recibe los correos de alerta de tu banco y confírmalos como ingresos o gastos desde Finanzas → Bandeja del
          banco. Funciona con Gmail sin servicios de pago.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ol className="grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-lg border p-3">
            <p className="font-medium">1. Genera la clave</p>
            <p className="mt-1 text-muted-foreground">
              Identifica a tu automatización ante Capitalia. Si la vuelves a generar, la anterior deja de servir.
            </p>
          </li>
          <li className="rounded-lg border p-3">
            <p className="font-medium">2. Filtro en Gmail</p>
            <p className="mt-1 text-muted-foreground">
              Gmail → Configuración → Filtros → <em>De:</em> el correo de alertas de tu banco → aplicar la etiqueta{" "}
              <code className="rounded bg-muted px-1">capitalia</code>.
            </p>
          </li>
          <li className="rounded-lg border p-3">
            <p className="font-medium">3. Script de Google</p>
            <p className="mt-1 text-muted-foreground">
              En script.google.com pega el código de abajo, ejecútalo una vez y crea un activador cada 5 minutos.
            </p>
          </li>
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          {hasToken && !token ? (
            <Button variant="outline" onClick={() => setConfirmOpen(true)} disabled={isPending}>
              {isPending ? <Spinner /> : <RefreshCw aria-hidden="true" />}
              Generar clave nueva
            </Button>
          ) : !token ? (
            <Button onClick={generate} disabled={isPending}>
              {isPending ? <Spinner /> : <KeyRound aria-hidden="true" />}
              Generar clave
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => copyText(endpointUrl, "URL")}>
            <Copy aria-hidden="true" />
            Copiar URL del endpoint
          </Button>
        </div>

        {token && script ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                <Check className="mr-1 inline size-4 text-emerald-600" aria-hidden="true" />
                Clave lista. Este código ya incluye tu URL y tu clave:
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyText(token, "Clave")}>
                  <Copy aria-hidden="true" />
                  Copiar clave
                </Button>
                <Button size="sm" onClick={() => copyText(script, "Script")}>
                  <Copy aria-hidden="true" />
                  Copiar script
                </Button>
              </div>
            </div>
            <textarea
              readOnly
              value={script}
              rows={10}
              className="w-full resize-y rounded-md border bg-background p-2 font-mono text-xs"
              aria-label="Script de Google Apps Script"
              onFocus={(event) => event.currentTarget.select()}
            />
            <p className="text-xs text-muted-foreground">
              Guárdalo ahora: por seguridad la clave no se vuelve a mostrar. Si la pierdes, genera una nueva y
              actualiza el script.
            </p>
          </div>
        ) : null}

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="¿Generar una clave nueva?"
          description="La automatización actual dejará de funcionar hasta que pegues el script actualizado en script.google.com."
          confirmLabel="Generar"
          onConfirm={async () => {
            const result = await rotateInboxTokenAction();
            if (!result.success) {
              toast.error(result.error);
              return;
            }
            setToken(result.data.token);
          }}
        />
      </CardContent>
    </Card>
  );
}
