"use client";

import { Check, Inbox, Mail, MessageSquare, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { MoneyDisplay } from "@/components/shared/money-display";
import { TablePagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate, formatDateTime } from "@/lib/dates";
import { TRANSACTION_CATEGORY_LABELS } from "@/lib/labels";
import { discardInboxMessageAction, reprocessInboxAction, restoreInboxMessageAction } from "@/server/actions/inbox";
import type { InboxMessageDto } from "@/server/queries/inbox";
import type { PaginatedResult } from "@/types";

import { ConfirmInboxDialog } from "./confirm-inbox-dialog";

type InboxListProps = {
  result: PaginatedResult<InboxMessageDto>;
  status: "PENDING" | "CONFIRMED" | "DISCARDED";
  query?: string;
};

const TABS = [
  { value: "PENDING", label: "Por clasificar" },
  { value: "CONFIRMED", label: "Confirmados" },
  { value: "DISCARDED", label: "Descartados" },
] as const;

export function InboxList({ result, status, query }: InboxListProps) {
  const messages = result.items;
  const { setParams } = useUrlParams();
  const [confirming, setConfirming] = useState<InboxMessageDto | null>(null);
  const [isPending, startTransition] = useTransition();

  const discard = (message: InboxMessageDto) =>
    startTransition(async () => {
      const result = await discardInboxMessageAction(message.id);
      if (!result.success) toast.error(result.error);
      else toast.success("Mensaje descartado");
    });

  const reprocess = () =>
    startTransition(async () => {
      const response = await reprocessInboxAction();
      if (!response.success) toast.error(response.error);
      else toast.success(`${response.data.updated} mensajes actualizados · ${response.data.discarded} avisos descartados`);
    });

  const restore = (message: InboxMessageDto) =>
    startTransition(async () => {
      const result = await restoreInboxMessageAction(message.id);
      if (!result.success) toast.error(result.error);
      else toast.success("Mensaje devuelto a la bandeja");
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={status} onValueChange={(value) => setParams({ status: value === "PENDING" ? null : value }, { resetPage: true })}>
          <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="shrink-0">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput placeholder="Buscar por comercio, asunto o remitente" />
          {status === "PENDING" ? (
            <Button variant="outline" onClick={reprocess} disabled={isPending}>
              <RefreshCw aria-hidden="true" />
              Volver a analizar
            </Button>
          ) : null}
        </div>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={query ? "Sin resultados" : status === "PENDING" ? "Nada por clasificar" : "Sin mensajes"}
          description={
            query
              ? "Prueba con otro texto."
              : status === "PENDING"
                ? "Cuando el banco te envíe un correo y tu automatización lo reenvíe, aparecerá aquí para que lo confirmes."
                : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {messages.map((message) => {
            const type = message.direction === "INCOME" ? "INCOME" : "EXPENSE";
            return (
              <li key={message.id} className="rounded-lg border bg-card p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{message.description}</span>
                      {message.direction === "UNKNOWN" ? (
                        <StatusBadge tone="warning">Tipo por definir</StatusBadge>
                      ) : (
                        <StatusBadge tone={type === "INCOME" ? "success" : "danger"}>
                          {type === "INCOME" ? "Ingreso" : "Gasto"}
                        </StatusBadge>
                      )}
                      <StatusBadge tone="neutral">{TRANSACTION_CATEGORY_LABELS[message.suggestedCategory]}</StatusBadge>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {message.source === "EMAIL" ? <Mail className="size-3" aria-hidden="true" /> : <MessageSquare className="size-3" aria-hidden="true" />}
                      <span>{message.sender ?? "Remitente desconocido"}</span>
                      <span>· recibido {formatDateTime(new Date(message.receivedAt))}</span>
                      <span>· fecha sugerida {formatDate(message.suggestedDate)}</span>
                    </p>
                    {message.subject ? <p className="mt-1 text-sm text-muted-foreground">{message.subject}</p> : null}
                    <details className="mt-1 text-xs text-muted-foreground">
                      <summary className="cursor-pointer select-none">Ver mensaje original</summary>
                      <p className="mt-1 whitespace-pre-wrap break-words rounded bg-muted/50 p-2">{message.body}</p>
                    </details>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {message.amount !== null ? (
                      <MoneyDisplay
                        value={type === "INCOME" ? message.amount : -message.amount}
                        tone={type === "INCOME" ? "positive" : "negative"}
                        signed
                        className="text-lg font-semibold"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">Monto no detectado</span>
                    )}
                    {status === "PENDING" ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => discard(message)} disabled={isPending}>
                          <Trash2 aria-hidden="true" />
                          Descartar
                        </Button>
                        <Button size="sm" onClick={() => setConfirming(message)}>
                          <Check aria-hidden="true" />
                          Confirmar
                        </Button>
                      </div>
                    ) : status === "DISCARDED" ? (
                      <Button size="sm" variant="outline" onClick={() => restore(message)} disabled={isPending}>
                        <RotateCcw aria-hidden="true" />
                        Restaurar
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TablePagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={result.pageSize}
        itemLabel="mensajes"
      />

      <ConfirmInboxDialog message={confirming} onOpenChange={(open) => !open && setConfirming(null)} />
    </div>
  );
}
