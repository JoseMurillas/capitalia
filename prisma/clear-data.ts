import "dotenv/config";

import { prisma } from "@/lib/prisma";

/**
 * `npm run db:clear` — deletes every person, loan, installment, payment and
 * transaction, keeping users. Guarded by CONFIRM_CLEAR=yes so it cannot run by
 * accident against a database you care about.
 */
async function main() {
  if (process.env.CONFIRM_CLEAR !== "yes") {
    console.error("Esto borra TODAS las personas, préstamos, pagos y movimientos.");
    console.error("Para confirmar, ejecuta con la variable CONFIRM_CLEAR=yes.");
    process.exit(1);
  }

  const [loans, people, transactions] = await prisma.$transaction([
    prisma.loan.deleteMany(),
    prisma.person.deleteMany(),
    prisma.transaction.deleteMany(),
  ]);
  console.log(
    `Eliminados: ${loans.count} préstamos (con sus cuotas y pagos), ${people.count} personas, ${transactions.count} movimientos.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
