"use client";

import { Wallet } from "lucide-react";
import Link from "next/link";
import type { FieldError } from "react-hook-form";

import { FormItem } from "@/components/shared/form-item";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCOUNT_KIND_LABELS } from "@/lib/labels";
import type { AccountOption } from "@/server/queries/accounts";

type AccountFieldProps = {
  /** Id of the trigger, so the label points at the control. */
  id: string;
  accounts: AccountOption[];
  value: string;
  onChange: (value: string) => void;
  error?: FieldError;
};

/**
 * Notice shown where the «Cuenta» selector would go when there is nothing to
 * pick yet. The field is required, so an empty selector could only ever fail
 * validation and leave Guardar dead with nothing on screen explaining it: the
 * form says what is missing and where to fix it instead.
 */
export function NoAccountsNotice() {
  return (
    <Alert>
      <Wallet aria-hidden="true" />
      <AlertTitle>Todavía no tienes cuentas</AlertTitle>
      <AlertDescription>
        Cada movimiento entra o sale de una cuenta.{" "}
        <Link href="/finanzas/cuentas">Crea la primera cuenta</Link> y vuelve a registrarlo.
      </AlertDescription>
    </Alert>
  );
}

/** The «Cuenta» field every movement form shows: required, and never empty-handed. */
export function AccountField({ id, accounts, value, onChange, error }: AccountFieldProps) {
  if (accounts.length === 0) return <NoAccountsNotice />;

  return (
    <FormItem label="Cuenta" htmlFor={id} error={error} description="De dónde sale o a dónde entra el dinero.">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)}>
          <SelectValue placeholder="Elige la cuenta" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name} — {ACCOUNT_KIND_LABELS[account.kind]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormItem>
  );
}
