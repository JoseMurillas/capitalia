import type { Prisma } from "@/generated/prisma/client";
import { advanceDueDate, toDbString, toDecimal } from "@/lib/calculations";
import { fromIsoDate, type IsoDate, toIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { MarkRecurringPaidInput, RecurringExpenseInput } from "@/lib/validations/recurring";

import { NotFoundError, ServiceError } from "../errors";
import { createTransaction } from "./transactions";

type Db = Prisma.TransactionClient | typeof prisma;

function toData(input: RecurringExpenseInput) {
  const usesCard = input.paymentMethod === "CREDIT_CARD";
  return {
    name: input.name,
    category: input.category,
    amount: toDbString(input.amount),
    isVariable: input.isVariable,
    frequency: input.frequency,
    customIntervalDays: input.frequency === "CUSTOM" ? (input.customIntervalDays ?? null) : null,
    nextDueDate: fromIsoDate(input.nextDueDate),
    paymentMethod: input.paymentMethod,
    creditCardId: usesCard ? (input.creditCardId ?? null) : null,
    reminderDays: input.reminderDays,
    notes: input.notes,
  };
}

async function assertCardUsable(db: Db, cardId: string) {
  const card = await db.creditCard.findUnique({ where: { id: cardId }, select: { name: true, active: true } });
  if (!card) throw new ServiceError("La tarjeta seleccionada no existe", { creditCardId: ["La tarjeta no existe"] });
  if (!card.active) {
    throw new ServiceError(`La tarjeta ${card.name} está inactiva`, { creditCardId: ["La tarjeta está inactiva"] });
  }
  return card;
}

async function requireExpense(db: Db, id: string) {
  const expense = await db.recurringExpense.findUnique({ where: { id }, include: { creditCard: true } });
  if (!expense) throw new NotFoundError("El gasto recurrente");
  return expense;
}

export async function createRecurringExpense(input: RecurringExpenseInput) {
  const cardId = input.paymentMethod === "CREDIT_CARD" ? input.creditCardId : null;
  if (cardId) await assertCardUsable(prisma, cardId);
  return prisma.recurringExpense.create({ data: toData(input), select: { id: true } });
}

export async function updateRecurringExpense(id: string, input: RecurringExpenseInput) {
  await requireExpense(prisma, id);
  const cardId = input.paymentMethod === "CREDIT_CARD" ? input.creditCardId : null;
  if (cardId) await assertCardUsable(prisma, cardId);
  await prisma.recurringExpense.update({ where: { id }, data: toData(input) });
}

export async function setRecurringActive(id: string, active: boolean) {
  await requireExpense(prisma, id);
  await prisma.recurringExpense.update({ where: { id }, data: { active } });
}

/** Past movements keep existing; their `recurringExpenseId` becomes null (SetNull). */
export async function deleteRecurringExpense(id: string) {
  await requireExpense(prisma, id);
  await prisma.recurringExpense.delete({ where: { id } });
}

/**
 * Records one payment of a recurring expense: an expense in Finanzas (cash methods) or a
 * charge on the linked card (CREDIT_CARD), then advances the next due date by one period.
 */
export async function markRecurringPaid(
  id: string,
  input: MarkRecurringPaidInput,
): Promise<{ nextDueDate: IsoDate; chargedToCard: string | null }> {
  return prisma.$transaction(async (tx) => {
    const expense = await requireExpense(tx, id);
    if (!expense.active) throw new ServiceError("El gasto está pausado; actívalo para registrar el pago");

    let chargedToCard: string | null = null;
    if (expense.paymentMethod === "CREDIT_CARD") {
      const card = expense.creditCard;
      if (!card) throw new ServiceError("El gasto no tiene una tarjeta asociada; edítalo y elige una");
      if (!card.active) throw new ServiceError(`La tarjeta ${card.name} está inactiva`);
      await tx.creditCardMovement.create({
        data: {
          creditCardId: card.id,
          kind: "CHARGE",
          amount: toDbString(input.amount),
          movementDate: fromIsoDate(input.paidDate),
          description: expense.name,
          recurringExpenseId: expense.id,
        },
      });
      await tx.creditCard.update({
        where: { id: card.id },
        data: { balance: toDbString(toDecimal(card.balance).plus(input.amount)) },
      });
      chargedToCard = card.name;
    } else {
      await createTransaction(
        {
          type: "EXPENSE",
          category: expense.category,
          amount: input.amount,
          description: expense.name,
          transactionDate: input.paidDate,
          notes: null,
        },
        tx,
        { recurringExpenseId: expense.id },
      );
    }

    const nextDueDate = advanceDueDate(toIsoDate(expense.nextDueDate), expense.frequency, expense.customIntervalDays);
    await tx.recurringExpense.update({
      where: { id },
      data: { nextDueDate: fromIsoDate(nextDueDate), lastPaidDate: fromIsoDate(input.paidDate) },
    });

    return { nextDueDate, chargedToCard };
  });
}
