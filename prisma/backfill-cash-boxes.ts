import "dotenv/config";

import { toDbString } from "@/lib/calculations";
import { todayIso } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/**
 * `npm run db:backfill-cash-boxes` — one-off migration helper.
 *
 * Moves existing loans into a cash box called "General" and rebuilds its ledger
 * from what already happened: one disbursement per loan and one entry per
 * payment received, plus an opening balance equal to the capital those loans
 * needed. Cancelled loans are assigned to the box for traceability but move no
 * money (cancelling requires a loan with no payments). Idempotent: it stops as
 * soon as any cash box exists.
 */
async function main() {
  const existing = await prisma.cashBox.count();
  if (existing > 0) {
    console.log(`Ya existen ${existing} cajas; no se hace nada.`);
    return;
  }

  const loans = await prisma.loan.findMany({
    where: { cashBoxId: null },
    select: {
      id: true,
      status: true,
      principalAmount: true,
      startDate: true,
      person: { select: { name: true } },
      payments: { select: { id: true, amount: true, paymentDate: true }, orderBy: { paymentDate: "asc" } },
    },
    orderBy: { startDate: "asc" },
  });

  const funded = loans.filter((loan) => loan.status !== "CANCELLED");
  const openingBalance = funded.reduce((total, loan) => total + Number(loan.principalAmount), 0);

  await prisma.$transaction(async (tx) => {
    const box = await tx.cashBox.create({
      data: { name: "General", description: "Caja creada al migrar los préstamos existentes." },
      select: { id: true },
    });

    await tx.loan.updateMany({ where: { cashBoxId: null }, data: { cashBoxId: box.id } });

    if (openingBalance > 0) {
      await tx.cashBoxMovement.create({
        data: {
          cashBoxId: box.id,
          kind: "OPENING",
          amount: toDbString(openingBalance),
          movementDate: funded[0]?.startDate ?? new Date(`${todayIso()}T00:00:00.000Z`),
          description: "Saldo inicial reconstruido",
          notes: "Capital que respaldaba los préstamos existentes al migrar.",
        },
      });
    }

    for (const loan of funded) {
      await tx.cashBoxMovement.create({
        data: {
          cashBoxId: box.id,
          kind: "LOAN_DISBURSEMENT",
          amount: toDbString(-Number(loan.principalAmount)),
          movementDate: loan.startDate,
          description: `Préstamo a ${loan.person.name}`,
          loanId: loan.id,
        },
      });
      for (const payment of loan.payments) {
        await tx.cashBoxMovement.create({
          data: {
            cashBoxId: box.id,
            kind: "LOAN_PAYMENT",
            amount: toDbString(payment.amount),
            movementDate: payment.paymentDate,
            description: `Pago de ${loan.person.name}`,
            loanId: loan.id,
            paymentId: payment.id,
          },
        });
      }
    }
  });

  const payments = funded.reduce((count, loan) => count + loan.payments.length, 0);
  console.log(
    `Caja «General» creada: ${loans.length} préstamos asignados (${funded.length} con movimientos) y ${payments} pagos reconstruidos.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
