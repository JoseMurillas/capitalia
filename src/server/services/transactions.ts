import { toDbString } from "@/lib/calculations";
import { fromIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { TransactionInput } from "@/lib/validations/transaction";

import { NotFoundError } from "../errors";

function toData(input: TransactionInput) {
  return {
    type: input.type,
    category: input.category,
    amount: toDbString(input.amount),
    description: input.description,
    transactionDate: fromIsoDate(input.transactionDate),
    notes: input.notes,
  };
}

export async function createTransaction(input: TransactionInput) {
  return prisma.transaction.create({ data: toData(input), select: { id: true } });
}

export async function updateTransaction(id: string, input: TransactionInput) {
  const existing = await prisma.transaction.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("El movimiento");
  await prisma.transaction.update({ where: { id }, data: toData(input) });
}

export async function deleteTransaction(id: string) {
  const existing = await prisma.transaction.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("El movimiento");
  await prisma.transaction.delete({ where: { id } });
}
