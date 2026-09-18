import "dotenv/config";

import { hash } from "bcryptjs";

import { addDaysIso, addMonthsIso, fromIsoDate, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { cancelLoan, createLoan, syncOverdueStatuses } from "@/server/services/loans";
import { registerPayment } from "@/server/services/payments";
import type { LoanInput } from "@/lib/validations/loan";

const today = todayIso();

async function seedAdmin() {
  const name = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@capitalia.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin123*";
  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { name, email, passwordHash },
  });
  console.log(`Admin listo: ${email}`);
}

async function resetBusinessData() {
  await prisma.loan.deleteMany();
  await prisma.person.deleteMany();
  await prisma.transaction.deleteMany();
}

async function seedPeople() {
  const people = await Promise.all(
    [
      { name: "Juan Pérez", phone: "3001234567", document: "1020304050", email: "juan.perez@example.com", address: "Cra 15 # 45-20, Bogotá" },
      { name: "María Gómez", phone: "3109876543", document: "52123456", email: "maria.gomez@example.com", address: "Cl 80 # 12-30, Medellín" },
      { name: "Carlos Rodríguez", phone: "3155551234", document: "79456123", address: "Av 6N # 23-45, Cali" },
      { name: "Ana Martínez", phone: "3201112233", document: "1032456789", email: "ana.martinez@example.com" },
      { name: "Luis Torres", phone: "3187654321", document: "80123987", notes: "Referido por Juan" },
      { name: "Pedro Sánchez", phone: "3009988776", document: "71234567", address: "Barrio Centro, Bucaramanga" },
      { name: "Laura Ramírez", phone: "3123334455", document: "43210987", active: false, notes: "Inactiva: se mudó fuera del país" },
    ].map((data) => prisma.person.create({ data })),
  );
  console.log(`${people.length} personas creadas`);
  return Object.fromEntries(people.map((p) => [p.name, p.id]));
}

type SeedLoan = {
  input: LoanInput;
  /** Payments applied in order with the app's own registerPayment service. */
  payments?: { date: string; amount: number; method?: "CASH" | "BANK_TRANSFER" | "OTHER" }[];
  cancel?: boolean;
};

function loan(input: LoanInput): LoanInput {
  return input;
}

async function seedLoans(personIds: Record<string, string>) {
  const loans: SeedLoan[] = [
    {
      // Fully paid on time.
      input: loan({
        personId: personIds["Juan Pérez"],
        principalAmount: 1_000_000,
        monthlyInterestRate: 12,
        interestType: "SIMPLE",
        numberOfInstallments: 3,
        installmentFrequency: "MONTHLY",
        startDate: addMonthsIso(today, -4),
        notes: "Préstamo para inventario de su tienda",
      }),
      payments: [
        { date: addMonthsIso(today, -3), amount: 453_333.33, method: "BANK_TRANSFER" },
        { date: addMonthsIso(today, -2), amount: 453_333.33, method: "BANK_TRANSFER" },
        { date: addMonthsIso(today, -1), amount: 453_333.34, method: "CASH" },
      ],
    },
    {
      // Second installment unpaid and past due → OVERDUE.
      input: loan({
        personId: personIds["María Gómez"],
        principalAmount: 2_000_000,
        monthlyInterestRate: 10,
        interestType: "SIMPLE",
        numberOfInstallments: 4,
        installmentFrequency: "MONTHLY",
        startDate: addDaysIso(addMonthsIso(today, -2), -10),
        notes: "Remodelación de cocina",
      }),
      payments: [{ date: addDaysIso(addMonthsIso(today, -1), -10), amount: 700_000, method: "CASH" }],
    },
    {
      // Biweekly, first installment partially paid and due in a few days.
      input: loan({
        personId: personIds["Carlos Rodríguez"],
        principalAmount: 500_000,
        monthlyInterestRate: 15,
        interestType: "SIMPLE",
        numberOfInstallments: 4,
        installmentFrequency: "BIWEEKLY",
        startDate: addDaysIso(today, -10),
      }),
      payments: [{ date: addDaysIso(today, -2), amount: 50_000, method: "CASH" }],
    },
    {
      // First installment due today and paid today.
      input: loan({
        personId: personIds["Ana Martínez"],
        principalAmount: 3_000_000,
        monthlyInterestRate: 8,
        interestType: "SIMPLE",
        numberOfInstallments: 6,
        installmentFrequency: "MONTHLY",
        startDate: addMonthsIso(today, -1),
        notes: "Matrícula universitaria",
      }),
      payments: [{ date: today, amount: 740_000, method: "BANK_TRANSFER" }],
    },
    {
      // Single installment, nothing paid yet, due in 15 days.
      input: loan({
        personId: personIds["Luis Torres"],
        principalAmount: 800_000,
        monthlyInterestRate: 12,
        interestType: "SIMPLE",
        numberOfInstallments: 1,
        installmentFrequency: "MONTHLY",
        startDate: addDaysIso(today, -15),
      }),
    },
    {
      // Weekly, third installment overdue.
      input: loan({
        personId: personIds["Pedro Sánchez"],
        principalAmount: 1_500_000,
        monthlyInterestRate: 10,
        interestType: "SIMPLE",
        numberOfInstallments: 5,
        installmentFrequency: "WEEKLY",
        startDate: addDaysIso(today, -22),
        notes: "Capital de trabajo",
      }),
      payments: [
        { date: addDaysIso(today, -15), amount: 337_500, method: "CASH" },
        { date: addDaysIso(today, -8), amount: 337_500, method: "CASH" },
      ],
    },
    {
      // Cancelled before any payment.
      input: loan({
        personId: personIds["Juan Pérez"],
        principalAmount: 300_000,
        monthlyInterestRate: 12,
        interestType: "SIMPLE",
        numberOfInstallments: 2,
        installmentFrequency: "MONTHLY",
        startDate: addDaysIso(today, -5),
        notes: "Desistió del préstamo",
      }),
      cancel: true,
    },
  ];

  let paymentCount = 0;
  for (const seed of loans) {
    const { id } = await createLoan(seed.input);
    for (const payment of seed.payments ?? []) {
      await registerPayment({
        loanId: id,
        installmentId: null,
        amount: payment.amount,
        paymentDate: payment.date,
        paymentMethod: payment.method ?? "CASH",
        notes: null,
      });
      paymentCount += 1;
    }
    if (seed.cancel) await cancelLoan(id);
  }
  await syncOverdueStatuses(today);
  console.log(`${loans.length} préstamos y ${paymentCount} pagos creados`);
}

async function seedTransactions() {
  const rows: {
    type: "INCOME" | "EXPENSE";
    category:
      | "SALARY"
      | "LOAN_INTEREST"
      | "OTHER_INCOME"
      | "FOOD"
      | "TRANSPORT"
      | "HOUSING"
      | "SERVICES"
      | "ENTERTAINMENT"
      | "OTHER_EXPENSE";
    amount: number;
    description: string;
    transactionDate: string;
  }[] = [];

  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo -= 1) {
    const monthStart = `${addMonthsIso(today, -monthsAgo).slice(0, 7)}-01`;
    const day = (d: number) => addDaysIso(monthStart, d - 1);
    const isCurrentMonth = monthsAgo === 0;

    rows.push(
      { type: "INCOME", category: "SALARY", amount: 4_500_000, description: "Salario", transactionDate: day(1) },
      { type: "EXPENSE", category: "HOUSING", amount: 1_200_000, description: "Arriendo", transactionDate: day(5) },
      { type: "EXPENSE", category: "SERVICES", amount: 350_000, description: "Servicios públicos", transactionDate: day(8) },
      { type: "EXPENSE", category: "FOOD", amount: 800_000 - monthsAgo * 20_000, description: "Mercado", transactionDate: day(10) },
    );
    if (!isCurrentMonth || today >= day(15)) {
      rows.push(
        { type: "EXPENSE", category: "TRANSPORT", amount: 250_000, description: "Transporte", transactionDate: day(15) },
        { type: "EXPENSE", category: "ENTERTAINMENT", amount: 180_000 + monthsAgo * 15_000, description: "Salidas y streaming", transactionDate: day(20) },
      );
    }
    if (monthsAgo === 3) {
      rows.push({ type: "INCOME", category: "OTHER_INCOME", amount: 900_000, description: "Venta de equipo usado", transactionDate: day(18) });
    }
  }

  await prisma.transaction.createMany({
    data: rows
      .filter((r) => r.transactionDate <= today)
      .map((r) => ({ ...r, transactionDate: fromIsoDate(r.transactionDate) })),
  });
  console.log(`${rows.length} movimientos creados`);
}

async function main() {
  await seedAdmin();
  await resetBusinessData();
  const personIds = await seedPeople();
  await seedLoans(personIds);
  await seedTransactions();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
