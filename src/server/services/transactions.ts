import type { Prisma } from "@/generated/prisma/client";
import { toDbString } from "@/lib/calculations";
import { fromIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { TransactionInput } from "@/lib/validations/transaction";

import { NotFoundError } from "../errors";
import { assertAccountUsable } from "./accounts";

type Db = Prisma.TransactionClient | typeof prisma;

lñ
  return {
    type: input.type,
    category: input.category,
    amount: toDbString(input.amount),
    description: input.description,
    transactionDate: fromIsoDate(input.transactionDate),
    accountId: input.accountId,
    notes: input.notes,
  };
}

type CreateTransactionOptions = {
  /** Links the movement to the recurring expense that generated it. */
  recurringExpenseId?: string | null;
};

/** `db` lets callers run the insert inside their own transaction. */
export async function createTransaction(
  input: TransactionData,
  db: Db = prisma,
  options: CreateTransactionOptions = {},
) {
  // Checked inside the caller's transaction so the account cannot be
  // deactivated between the check and the insert.
  await assertAccountUsable(db, input.accountId, "accountId");
  return db.transaction.create({
    data: { ...toData(input), recurringExpenseId: options.recurringExpenseId ?? null },
    select: { id: true },
  });
}

export async function updateTransaction(id: string, input: TransactionInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError("El movimiento");
    await assertAccountUsable(tx, input.accountId, "accountId");
    await tx.transaction.update({ where: { id }, data: toData(input) });
  });
}

export async function deleteTransaction(id: string) {
  const existing = await prisma.transaction.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("El movimiento");
  await prisma.transaction.delete({ where: { id } });
}
