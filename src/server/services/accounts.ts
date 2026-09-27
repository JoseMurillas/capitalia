import { randomUUID } from "node:crypto";

import type Decimal from "decimal.js";

import type { Prisma } from "@/generated/prisma/client";
import { accountBalance, type MoneyInput, toDbString, toDecimal, transferLegs } from "@/lib/calculations";
import { fromIsoDate, type IsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type {
  AccountAdjustmentInput,
  AccountInput,
  AccountTransferInput,
  CreateAccountInput,
} from "@/lib/validations/account";

import { NotFoundError, ServiceError } from "../errors";

export type Db = Prisma.TransactionClient | typeof prisma;

/**
 * The account's balance, read inside whatever transaction the caller is running.
 * Nothing is ever blocked by it: while movements remain unassigned the balance
 * is incomplete by design (spec §4.1), so a negative is shown, never refused.
 */
export async function accountBalanceOf(db: Db, accountId: string): Promise<Decimal> {
  const [movements, transactions] = await Promise.all([
    db.accountMovement.findMany({ where: { accountId }, select: { amount: true } }),
    db.transaction.findMany({ where: { accountId }, select: { type: true, amount: true } }),
  ]);
  return accountBalance({ movements, transactions });
}

export async function assertAccountUsable(db: Db, accountId: string, field?: string) {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, active: true },
  });
  if (!account) {
    const message = "La cuenta seleccionada no existe";
    throw new ServiceError(message, field ? { [field]: [message] } : undefined);
  }
  if (!account.active) {
    const message = `La cuenta ${account.name} está inactiva`;
    throw new ServiceError(message, field ? { [field]: ["La cuenta está inactiva"] } : undefined);
  }
  return { id: account.id, name: account.name };
}

type MovementDraft = {
  accountId: string;
  kind: "OPENING" | "TRANSFER" | "CASH_BOX" | "ADJUSTMENT";
  /** Signed. */
  amount: MoneyInput;
  movementDate: IsoDate;
  description: string;
  notes?: string | null;
  cashBoxMovementId?: string | null;
  transferGroupId?: string | null;
};

/** Single writer for the ledger: every row goes through here with the same shape. */
export async function writeAccountMovement(db: Db, draft: MovementDraft) {
  return db.accountMovement.create({
    data: {
      accountId: draft.accountId,
      kind: draft.kind,
      amount: toDbString(draft.amount),
      movementDate: fromIsoDate(draft.movementDate),
      description: draft.description,
      notes: draft.notes ?? null,
      cashBoxMovementId: draft.cashBoxMovementId ?? null,
      transferGroupId: draft.transferGroupId ?? null,
    },
  });
}

export async function createAccount(input: CreateAccountInput) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        name: input.name,
        kind: input.kind,
        issuer: input.issuer,
        last4: input.last4,
        notes: input.notes,
      },
      select: { id: true },
    });
    // An opening balance is a movement like any other, so the balance stays a sum.
    if (toDecimal(input.openingBalance).gt(0)) {
      await writeAccountMovement(tx, {
        accountId: account.id,
        kind: "OPENING",
        amount: input.openingBalance,
        movementDate: input.openingDate,
        description: "Saldo inicial",
      });
    }
    return account;
  });
}

export async function updateAccount(id: string, input: AccountInput) {
  const account = await prisma.account.findUnique({ where: { id }, select: { id: true } });
  if (!account) throw new NotFoundError("La cuenta");
  await prisma.account.update({
    where: { id },
    data: {
      name: input.name,
      kind: input.kind,
      issuer: input.issuer,
      last4: input.last4,
      notes: input.notes,
    },
  });
}

export async function setAccountActive(id: string, active: boolean) {
  const account = await prisma.account.findUnique({ where: { id }, select: { id: true } });
  if (!account) throw new NotFoundError("La cuenta");
  await prisma.account.update({ where: { id }, data: { active } });
}

/**
 * Only an account nothing ever happened in can be removed. Its opening balance
 * does not count: it is the account being born, not something that happened.
 */
export async function deleteAccount(id: string) {
  const account = await prisma.account.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { transactions: true, movements: { where: { kind: { not: "OPENING" } } } } },
    },
  });
  if (!account) throw new NotFoundError("La cuenta");
  if (account._count.transactions > 0 || account._count.movements > 0) {
    throw new ServiceError(
      "La cuenta ya tiene movimientos. Desactívala para dejar de usarla sin perder su historia.",
    );
  }
  await prisma.account.delete({ where: { id } });
}

export async function transferBetweenAccounts(fromId: string, input: AccountTransferInput) {
  if (fromId === input.toAccountId) {
    throw new ServiceError("Elige una cuenta distinta", { toAccountId: ["Elige una cuenta distinta"] });
  }
  await prisma.$transaction(async (tx) => {
    const from = await assertAccountUsable(tx, fromId);
    const to = await assertAccountUsable(tx, input.toAccountId, "toAccountId");
    // Both legs share the group, so the ledger can show them as one move, and
    // both signs come from one tested place so they cannot drift apart.
    const transferGroupId = randomUUID();
    const legs = transferLegs(input.amount);

    await writeAccountMovement(tx, {
      accountId: from.id,
      kind: "TRANSFER",
      amount: legs.from,
      movementDate: input.movementDate,
      description: input.description ?? `Transferencia a ${to.name}`,
      notes: input.notes,
      transferGroupId,
    });
    await writeAccountMovement(tx, {
      accountId: to.id,
      kind: "TRANSFER",
      amount: legs.to,
      movementDate: input.movementDate,
      description: input.description ?? `Transferencia desde ${from.name}`,
      notes: input.notes,
      transferGroupId,
    });
  });
}

export async function adjustAccount(id: string, input: AccountAdjustmentInput) {
  // A zero adjustment is a no-op dressed as a ledger row; the schema refuses it too.
  if (toDecimal(input.amount).isZero()) {
    throw new ServiceError("El ajuste no puede ser cero", { amount: ["El ajuste no puede ser cero"] });
  }
  await prisma.$transaction(async (tx) => {
    const account = await assertAccountUsable(tx, id);
    await writeAccountMovement(tx, {
      accountId: account.id,
      kind: "ADJUSTMENT",
      amount: input.amount,
      movementDate: input.movementDate,
      description: input.description,
      notes: input.notes,
    });
  });
}

/** Puts an old movement into an account; this is the manual assignment flow. */
export async function assignTransactionAccount(transactionId: string, accountId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { id: true },
  });
  if (!transaction) throw new NotFoundError("El movimiento");
  await assertAccountUsable(prisma, accountId, "accountId");
  await prisma.transaction.update({ where: { id: transactionId }, data: { accountId } });
}
