import type { Prisma } from "@/generated/prisma/client";
import { applyPayment, type MoneyInput, roundMoney, toDbString, toDecimal, toNumber } from "@/lib/calculations";
import { addMonthsIso, fromIsoDate, todayIso, toIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type {
  CreditCardInput,
  CreditCardPaymentInput,
  CreditCardStatementInput,
  InstallmentPlanInput,
} from "@/lib/validations/credit-card";

import { NotFoundError, ServiceError } from "../errors";
import { createTransaction } from "./transactions";

type Db = Prisma.TransactionClient | typeof prisma;

function optionalMoney(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : toDbString(value);
}

async function requireCard(db: Db, id: string) {
  const card = await db.creditCard.findUnique({ where: { id } });
  if (!card) throw new NotFoundError("La tarjeta");
  return card;
}

function toCardData(input: CreditCardInput) {
  return {
    name: input.name,
    creditLimit: toDbString(input.creditLimit),
    balance: toDbString(input.balance),
    minimumPayment: optionalMoney(input.minimumPayment),
    paymentAmount: optionalMoney(input.paymentAmount),
    nextClosingDate: fromIsoDate(input.nextClosingDate),
    nextPaymentDate: fromIsoDate(input.nextPaymentDate),
    reminderDays: input.reminderDays,
    notes: input.notes,
  };
}

/** Keeps the movement history honest whenever the balance is edited by hand. */
async function recordBalanceAdjustment(
  tx: Prisma.TransactionClient,
  cardId: string,
  previous: MoneyInput,
  next: MoneyInput,
  description: string,
) {
  const diff = roundMoney(toDecimal(next).minus(toDecimal(previous)));
  if (diff.isZero()) return;
  await tx.creditCardMovement.create({
    data: {
      creditCardId: cardId,
      kind: "ADJUSTMENT",
      amount: diff.toFixed(2),
      movementDate: fromIsoDate(todayIso()),
      description,
    },
  });
}

export async function createCreditCard(input: CreditCardInput) {
  return prisma.$transaction(async (tx) => {
    const card = await tx.creditCard.create({ data: toCardData(input), select: { id: true } });
    await recordBalanceAdjustment(tx, card.id, 0, input.balance, "Saldo inicial");
    return card;
  });
}

export async function updateCreditCard(id: string, input: CreditCardInput) {
  await prisma.$transaction(async (tx) => {
    const existing = await requireCard(tx, id);
    await tx.creditCard.update({ where: { id }, data: toCardData(input) });
    await recordBalanceAdjustment(tx, id, existing.balance, input.balance, "Ajuste manual");
  });
}

export async function updateCardStatement(id: string, input: CreditCardStatementInput) {
  await prisma.$transaction(async (tx) => {
    const existing = await requireCard(tx, id);
    await tx.creditCard.update({
      where: { id },
      data: {
        balance: toDbString(input.balance),
        minimumPayment: optionalMoney(input.minimumPayment),
        paymentAmount: optionalMoney(input.paymentAmount),
        nextClosingDate: fromIsoDate(input.nextClosingDate),
        nextPaymentDate: fromIsoDate(input.nextPaymentDate),
      },
    });
    await recordBalanceAdjustment(tx, id, existing.balance, input.balance, "Ajuste por extracto");
  });
}

export async function setCreditCardActive(id: string, active: boolean) {
  await requireCard(prisma, id);
  await prisma.creditCard.update({ where: { id }, data: { active } });
}

/**
 * Deletes a card. Adjustment movements (statement updates, the initial balance) don't
 * block deletion; charges and payments do, since removing the card would orphan them.
 */
export async function deleteCreditCard(id: string) {
  const card = await prisma.creditCard.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { movements: { where: { kind: { not: "ADJUSTMENT" } } }, recurringExpenses: true } },
    },
  });
  if (!card) throw new NotFoundError("La tarjeta");
  if (card._count.movements > 0 || card._count.recurringExpenses > 0) {
    throw new ServiceError(
      "La tarjeta tiene movimientos o gastos recurrentes asociados. Desactívala en lugar de eliminarla.",
    );
  }
  await prisma.creditCard.delete({ where: { id } });
}

/**
 * Pays the card from cash: creates the expense in Finanzas, logs the movement,
 * lowers the balance and (optionally) moves the cycle one month ahead.
 */
export async function registerCardPayment(id: string, input: CreditCardPaymentInput) {
  return prisma.$transaction(async (tx) => {
    const card = await requireCard(tx, id);
    if (!card.active) throw new ServiceError("La tarjeta está inactiva");

    const description = `Pago tarjeta ${card.name}`;
    const transaction = await createTransaction(
      {
        type: "EXPENSE",
        category: "CREDIT_CARD_PAYMENT",
        amount: input.amount,
        description,
        transactionDate: input.paidDate,
        notes: input.notes,
      },
      tx,
    );
    await tx.creditCardMovement.create({
      data: {
        creditCardId: id,
        kind: "PAYMENT",
        amount: toDbString(input.amount),
        movementDate: fromIsoDate(input.paidDate),
        description,
        transactionId: transaction.id,
      },
    });

    const newBalance = applyPayment(card.balance, input.amount);
    const data: Prisma.CreditCardUpdateInput = { balance: toDbString(newBalance) };
    if (input.advanceCycle) {
      data.nextClosingDate = fromIsoDate(addMonthsIso(toIsoDate(card.nextClosingDate), 1));
      data.nextPaymentDate = fromIsoDate(addMonthsIso(toIsoDate(card.nextPaymentDate), 1));
      data.paymentAmount = null;
      const plans = await tx.creditCardInstallmentPlan.findMany({
        where: { creditCardId: id },
        select: { id: true, installments: true, paidInstallments: true },
      });
      for (const plan of plans) {
        if (plan.paidInstallments >= plan.installments) continue;
        await tx.creditCardInstallmentPlan.update({
          where: { id: plan.id },
          data: { paidInstallments: { increment: 1 } },
        });
      }
    }
    await tx.creditCard.update({ where: { id }, data });

    return { transactionId: transaction.id, newBalance: toNumber(newBalance) };
  });
}

function toPlanData(input: InstallmentPlanInput) {
  return {
    description: input.description,
    totalAmount: toDbString(input.totalAmount),
    installmentAmount: toDbString(input.installmentAmount),
    installments: input.installments,
    paidInstallments: input.paidInstallments,
    startDate: fromIsoDate(input.startDate),
    notes: input.notes,
  };
}

async function requirePlan(cardId: string, id: string) {
  const plan = await prisma.creditCardInstallmentPlan.findUnique({ where: { id }, select: { id: true, creditCardId: true } });
  if (!plan || plan.creditCardId !== cardId) throw new NotFoundError("La compra diferida");
  return plan;
}

export async function createInstallmentPlan(cardId: string, input: InstallmentPlanInput) {
  await requireCard(prisma, cardId);
  return prisma.creditCardInstallmentPlan.create({
    data: { creditCardId: cardId, ...toPlanData(input) },
    select: { id: true },
  });
}

export async function updateInstallmentPlan(cardId: string, id: string, input: InstallmentPlanInput) {
  await requirePlan(cardId, id);
  await prisma.creditCardInstallmentPlan.update({ where: { id }, data: toPlanData(input) });
}

export async function deleteInstallmentPlan(cardId: string, id: string) {
  await requirePlan(cardId, id);
  await prisma.creditCardInstallmentPlan.delete({ where: { id } });
}
