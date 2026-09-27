import "server-only";

import { cache } from "react";

import type { AccountKind } from "@/generated/prisma/enums";
import {
  accountBalance,
  runningBalance,
  summarizeAccounts,
  toDecimal,
  toNumber,
  transactionLedgerAmount,
} from "@/lib/calculations";
import { type IsoDate, toIsoDate } from "@/lib/dates";
import { ACCOUNT_MOVEMENT_KIND_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth";

export type AccountDto = {
  id: string;
  name: string;
  kind: AccountKind;
  issuer: string | null;
  last4: string | null;
  active: boolean;
  notes: string | null;
  balance: number;
  /**
   * Rows in the combined ledger, opening balance included. It is a count for
   * display, not a permission: whether an account can be deleted is decided by
   * `deleteAccount`, which ignores the opening balance because an account being
   * born is not something that happened to it.
   */
  movementCount: number;
};

export type AccountOption = { id: string; name: string; kind: AccountKind };

/** One line of the account's ledger, no matter which of the two tables wrote it. */
export type AccountEntryDto = {
  id: string;
  source: "MOVEMENT" | "TRANSACTION";
  /** Label already resolved, so the table and the phone card read the same. */
  kind: string;
  description: string;
  /** The business date, which is what the user recognises. */
  date: IsoDate;
  /** Signed: negative took money out of the account. */
  amount: number;
  /** What the account held right after this line, in write order. */
  runningBalance: number;
  /** Where the row leads, when it has somewhere to lead. */
  href: string | null;
};

export type AccountDetailDto = AccountDto & { entries: AccountEntryDto[] };

export type AccountsSummary = {
  total: number;
  /**
   * Accounts that are active, which is what `total` adds up. Zero of them means
   * the total is not the money the user has — see `availableMoney`.
   */
  activeCount: number;
  /** Finance movements still without an account; while there are any, totals are partial. */
  unassignedCount: number;
  byKind: { kind: AccountKind; total: number; count: number }[];
};

/**
 * Every account with its balance, active ones first and then by name.
 *
 * Cached per request: the accounts screen asks for this list and for the
 * summary, and the summary asks for the list again. Without the cache, opening
 * the screen reads every movement and every assigned transaction twice, and
 * that cost grows with the ledger forever.
 */
export const listAccounts = cache(async function listAccounts(): Promise<AccountDto[]> {
  await requireSession();
  const accounts = await prisma.account.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      movements: { select: { amount: true } },
      transactions: { select: { type: true, amount: true } },
    },
  });

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    kind: account.kind,
    issuer: account.issuer,
    last4: account.last4,
    active: account.active,
    notes: account.notes,
    balance: toNumber(accountBalance({ movements: account.movements, transactions: account.transactions })),
    movementCount: account.movements.length + account.transactions.length,
  }));
});

export async function getAccountsSummary(): Promise<AccountsSummary> {
  await requireSession();
  const [accounts, unassignedCount] = await Promise.all([
    listAccounts(),
    prisma.transaction.count({ where: { accountId: null } }),
  ]);
  const { total, byKind } = summarizeAccounts(accounts);
  return { total, activeCount: accounts.filter((account) => account.active).length, unassignedCount, byKind };
}

/**
 * The account's ledger, both sources in one list, newest first for reading.
 *
 * The running balance follows `createdAt`, not the business date shown on each
 * row: ordering it by the date the user typed makes an account open in the
 * negative, which is exactly what happened in the cash box detail before it was
 * fixed. The balance only means anything in the order the rows were written.
 */
export const getAccount = cache(async function getAccount(id: string): Promise<AccountDetailDto | null> {
  await requireSession();
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      movements: {
        orderBy: { createdAt: "asc" },
        // The mirrored cash box movement is how a row reaches the box it came
        // from, which is the jump the spec asks for in §6.
        include: { cashBoxMovement: { select: { cashBoxId: true } } },
      },
      transactions: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!account) return null;

  const rows = [
    ...account.movements.map((movement) => ({
      id: movement.id,
      source: "MOVEMENT" as const,
      // Kept alongside its label so the ordering below never depends on Spanish copy.
      movementKind: movement.kind,
      kind: ACCOUNT_MOVEMENT_KIND_LABELS[movement.kind],
      description: movement.description,
      date: toIsoDate(movement.movementDate),
      // Already signed in the database: the ledger can be summed blindly.
      amount: toDecimal(movement.amount),
      createdAt: movement.createdAt,
      href: movement.cashBoxMovement ? `/prestamos/cajas/${movement.cashBoxMovement.cashBoxId}` : null,
    })),
    ...account.transactions.map((transaction) => ({
      id: transaction.id,
      source: "TRANSACTION" as const,
      movementKind: null,
      kind: TRANSACTION_TYPE_LABELS[transaction.type],
      description: transaction.description,
      date: toIsoDate(transaction.transactionDate),
      // A finance movement stores an unsigned amount: an expense leaves here.
      amount: transactionLedgerAmount(transaction.type, transaction.amount),
      createdAt: transaction.createdAt,
      // There is no detail page for a finance movement, so the row lands on the
      // list already filtered to this account, where it is actually visible.
      href: `/finanzas/movimientos?cuenta=${account.id}`,
    })),
  ].sort((a, b) => {
    // The opening balance is the account being born, not something that happened
    // in it, so it leads however late it was written. Without this, assigning a
    // movement older than the account makes the ledger open in the negative and
    // show "Saldo inicial" halfway down — the very thing ordering by createdAt
    // was meant to prevent.
    const openingFirst = Number(a.movementKind !== "OPENING") - Number(b.movementKind !== "OPENING");
    return openingFirst !== 0 ? openingFirst : a.createdAt.getTime() - b.createdAt.getTime();
  });

  const entries: AccountEntryDto[] = runningBalance(rows)
    .map((row) => ({
      id: row.id,
      source: row.source,
      kind: row.kind,
      description: row.description,
      date: row.date,
      amount: toNumber(row.amount),
      runningBalance: toNumber(row.balance),
      href: row.href,
    }))
    .reverse();

  return {
    id: account.id,
    name: account.name,
    kind: account.kind,
    issuer: account.issuer,
    last4: account.last4,
    active: account.active,
    notes: account.notes,
    // The same sum the list card shows, so the two screens never disagree.
    balance: toNumber(accountBalance({ movements: account.movements, transactions: account.transactions })),
    movementCount: entries.length,
    entries,
  };
});

/** What the selectors show: only accounts you can still use. */
export async function getAccountOptions(): Promise<AccountOption[]> {
  await requireSession();
  return prisma.account.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, kind: true },
  });
}

/**
 * The accounts a filter may name, which is not the same as the ones you can
 * still use: a deactivated account keeps its history, so filtering the
 * movements by it has to keep working, or its own ledger would link to a list
 * that quietly shows everything.
 */
export async function getFilterableAccounts(): Promise<AccountOption[]> {
  await requireSession();
  return prisma.account.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, kind: true },
  });
}
