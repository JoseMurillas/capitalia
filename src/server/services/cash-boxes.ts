import { randomUUID } from "node:crypto";

import type Decimal from "decimal.js";

import type { Prisma } from "@/generated/prisma/client";
import {
  cashBoxBalance,
  type MoneyInput,
  reassignmentNet,
  signedAmount,
  sumMoney,
  toDbString,
  toDecimal,
  toNumber,
} from "@/lib/calculations";
import { fromIsoDate, type IsoDate, todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type {
  CashBoxAdjustmentInput,
  CashBoxInput,
  CashBoxMovementInput,
  CashBoxTransferInput,
  CreateCashBoxInput,
} from "@/lib/validations/cash-box";

import { NotFoundError, ServiceError } from "../errors";

export type Db = Prisma.TransactionClient | typeof prisma;

/** The box's balance, read inside whatever transaction the caller is running. */
export async function cashBoxAvailable(db: Db, cashBoxId: string): Promise<Decimal> {
  const movements = await db.cashBoxMovement.findMany({
    where: { cashBoxId },
    select: { amount: true },
  });
  return cashBoxBalance(movements);
}

export async function assertCashBoxUsable(db: Db, cashBoxId: string) {
  const box = await db.cashBox.findUnique({ where: { id: cashBoxId }, select: { id: true, name: true, active: true } });
  if (!box) throw new ServiceError("La caja seleccionada no existe", { cashBoxId: ["La caja no existe"] });
  if (!box.active) {
    throw new ServiceError(`La caja ${box.name} está inactiva`, { cashBoxId: ["La caja está inactiva"] });
  }
  return { id: box.id, name: box.name };
}

/** Refuses to let a box go negative; the message says how much it actually has. */
export async function assertSufficientBalance(db: Db, cashBoxId: string, amount: MoneyInput, field: string) {
  const [box, available] = await Promise.all([
    db.cashBox.findUnique({ where: { id: cashBoxId }, select: { name: true } }),
    cashBoxAvailable(db, cashBoxId),
  ]);
  if (available.lt(toDecimal(amount))) {
    const message = `La caja ${box?.name ?? ""} solo tiene ${formatMoney(toNumber(available))} disponibles`;
    throw new ServiceError(message, { [field]: [message] });
  }
}

type MovementData = {
  cashBoxId: string;
  kind: Parameters<typeof signedAmount>[0];
  amount: MoneyInput;
  movementDate: IsoDate;
  description: string;
  notes?: string | null;
  counterparty?: "PERSONAL_FINANCES" | "EXTERNAL" | null;
  relatedCashBoxId?: string | null;
  transferGroupId?: string | null;
  loanId?: string | null;
  paymentId?: string | null;
};

/** Single writer for the ledger: every row goes through here with its sign fixed. */
async function writeMovement(db: Db, data: MovementData) {
  await db.cashBoxMovement.create({
    data: {
      cashBoxId: data.cashBoxId,
      kind: data.kind,
      amount: toDbString(signedAmount(data.kind, data.amount)),
      movementDate: fromIsoDate(data.movementDate),
      description: data.description,
      notes: data.notes ?? null,
      counterparty: data.counterparty ?? null,
      relatedCashBoxId: data.relatedCashBoxId ?? null,
      transferGroupId: data.transferGroupId ?? null,
      loanId: data.loanId ?? null,
      paymentId: data.paymentId ?? null,
    },
  });
}

export async function createCashBox(input: CreateCashBoxInput) {
  return prisma.$transaction(async (tx) => {
    const box = await tx.cashBox.create({
      data: { name: input.name, description: input.description },
      select: { id: true },
    });
    if (toDecimal(input.openingBalance).gt(0)) {
      await writeMovement(tx, {
        cashBoxId: box.id,
        kind: "OPENING",
        amount: input.openingBalance,
        movementDate: todayIso(),
        description: "Saldo inicial",
      });
    }
    return box;
  });
}

export async function updateCashBox(id: string, input: CashBoxInput) {
  const box = await prisma.cashBox.findUnique({ where: { id }, select: { id: true } });
  if (!box) throw new NotFoundError("La caja");
  await prisma.cashBox.update({ where: { id }, data: { name: input.name, description: input.description } });
}

export async function setCashBoxActive(id: string, active: boolean) {
  const box = await prisma.cashBox.findUnique({ where: { id }, select: { id: true } });
  if (!box) throw new NotFoundError("La caja");
  await prisma.cashBox.update({ where: { id }, data: { active } });
}

/** Only an untouched box can disappear; anything with history is deactivated. */
export async function deleteCashBox(id: string) {
  const box = await prisma.cashBox.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { loans: true, movements: { where: { kind: { not: "OPENING" } } } } },
    },
  });
  if (!box) throw new NotFoundError("La caja");
  if (box._count.loans > 0 || box._count.movements > 0) {
    throw new ServiceError(
      "La caja tiene préstamos o movimientos registrados. Desactívala en lugar de eliminarla.",
    );
  }
  await prisma.cashBox.delete({ where: { id } });
}

export async function depositToCashBox(id: string, input: CashBoxMovementInput) {
  await prisma.$transaction(async (tx) => {
    const box = await assertCashBoxUsable(tx, id);
    await writeMovement(tx, {
      cashBoxId: box.id,
      kind: "DEPOSIT",
      amount: input.amount,
      movementDate: input.movementDate,
      description: input.description ?? "Aporte de capital",
      notes: input.notes,
      counterparty: input.counterparty,
    });
  });
}

export async function withdrawFromCashBox(id: string, input: CashBoxMovementInput) {
  await prisma.$transaction(async (tx) => {
    const box = await assertCashBoxUsable(tx, id);
    await assertSufficientBalance(tx, box.id, input.amount, "amount");
    await writeMovement(tx, {
      cashBoxId: box.id,
      kind: "WITHDRAWAL",
      amount: input.amount,
      movementDate: input.movementDate,
      description: input.description ?? "Retiro de capital",
      notes: input.notes,
      counterparty: input.counterparty,
    });
  });
}

export async function transferBetweenCashBoxes(fromId: string, input: CashBoxTransferInput) {
  if (fromId === input.toCashBoxId) {
    throw new ServiceError("Elige una caja distinta", { toCashBoxId: ["Elige una caja distinta"] });
  }
  await prisma.$transaction(async (tx) => {
    const from = await assertCashBoxUsable(tx, fromId);
    const to = await assertCashBoxUsable(tx, input.toCashBoxId);
    await assertSufficientBalance(tx, from.id, input.amount, "amount");

    const transferGroupId = randomUUID();
    const description = input.description ?? `Traslado ${from.name} → ${to.name}`;
    await writeMovement(tx, {
      cashBoxId: from.id,
      kind: "TRANSFER_OUT",
      amount: input.amount,
      movementDate: input.movementDate,
      description,
      notes: input.notes,
      relatedCashBoxId: to.id,
      transferGroupId,
    });
    await writeMovement(tx, {
      cashBoxId: to.id,
      kind: "TRANSFER_IN",
      amount: input.amount,
      movementDate: input.movementDate,
      description,
      notes: input.notes,
      relatedCashBoxId: from.id,
      transferGroupId,
    });
  });
}

export async function adjustCashBox(id: string, input: CashBoxAdjustmentInput) {
  await prisma.$transaction(async (tx) => {
    const box = await assertCashBoxUsable(tx, id);
    if (toDecimal(input.amount).lt(0)) {
      await assertSufficientBalance(tx, box.id, toDecimal(input.amount).abs(), "amount");
    }
    await writeMovement(tx, {
      cashBoxId: box.id,
      kind: "ADJUSTMENT",
      amount: input.amount,
      movementDate: input.movementDate,
      description: "Ajuste de saldo",
      notes: input.notes,
    });
  });
}

export async function recordLoanDisbursement(
  db: Db,
  args: { cashBoxId: string; loanId: string; amount: MoneyInput; movementDate: IsoDate; personName: string },
) {
  await writeMovement(db, {
    cashBoxId: args.cashBoxId,
    kind: "LOAN_DISBURSEMENT",
    amount: args.amount,
    movementDate: args.movementDate,
    description: `Préstamo a ${args.personName}`,
    loanId: args.loanId,
  });
}

export async function recordLoanPayment(
  db: Db,
  args: {
    cashBoxId: string;
    loanId: string;
    paymentId: string;
    amount: MoneyInput;
    movementDate: IsoDate;
    personName: string;
  },
) {
  await writeMovement(db, {
    cashBoxId: args.cashBoxId,
    kind: "LOAN_PAYMENT",
    amount: args.amount,
    movementDate: args.movementDate,
    description: `Pago de ${args.personName}`,
    loanId: args.loanId,
    paymentId: args.paymentId,
  });
}

export async function recordLoanReversal(
  db: Db,
  args: {
    cashBoxId: string;
    loanId: string | null;
    amount: MoneyInput;
    personName: string;
    reason: "CANCELLED" | "DELETED";
  },
) {
  await writeMovement(db, {
    cashBoxId: args.cashBoxId,
    kind: "LOAN_REVERSAL",
    amount: args.amount,
    movementDate: todayIso(),
    description:
      args.reason === "CANCELLED"
        ? `Préstamo cancelado — ${args.personName}`
        : `Préstamo eliminado — ${args.personName}`,
    loanId: args.loanId,
  });
}

/**
 * Moves a loan to another box. The old box gets back exactly what it put in
 * (capital minus what has already returned) and the new one pays that amount;
 * the original movements stay where they happened.
 */
export async function reassignLoanCashBox(loanId: string, cashBoxId: string) {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        cashBoxId: true,
        principalAmount: true,
        person: { select: { name: true } },
        payments: { select: { amount: true } },
        cashBox: { select: { id: true, name: true } },
      },
    });
    if (!loan) throw new NotFoundError("El préstamo");
    if (!loan.cashBox) throw new ServiceError("El préstamo no tiene caja de origen; asígnale una primero");
    if (loan.cashBoxId === cashBoxId) {
      throw new ServiceError("El préstamo ya pertenece a esa caja", { cashBoxId: ["Elige una caja distinta"] });
    }

    const target = await assertCashBoxUsable(tx, cashBoxId);
    const net = reassignmentNet(loan.principalAmount, sumMoney(loan.payments.map((p) => p.amount)));
    if (net.gt(0)) await assertSufficientBalance(tx, target.id, net, "cashBoxId");

    const transferGroupId = randomUUID();
    const movementDate = todayIso();
    const description = `Reasignación del préstamo de ${loan.person.name}`;

    await writeMovement(tx, {
      cashBoxId: loan.cashBox.id,
      kind: "LOAN_REASSIGNMENT",
      amount: net,
      movementDate,
      description,
      relatedCashBoxId: target.id,
      transferGroupId,
      loanId: loan.id,
    });
    await writeMovement(tx, {
      cashBoxId: target.id,
      kind: "LOAN_REASSIGNMENT",
      amount: net.negated(),
      movementDate,
      description,
      relatedCashBoxId: loan.cashBox.id,
      transferGroupId,
      loanId: loan.id,
    });
    await tx.loan.update({ where: { id: loan.id }, data: { cashBoxId: target.id } });

    return { net: toNumber(net), fromName: loan.cashBox.name, toName: target.name };
  });
}
