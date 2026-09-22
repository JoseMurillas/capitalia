import "dotenv/config";

import { addDaysIso, addMonthsIso, fromIsoDate, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { cancelLoan, createLoan, syncOverdueStatuses } from "@/server/services/loans";
import { registerPayment } from "@/server/services/payments";
import type { LoanInput } from "@/lib/validations/loan";
import type { RecurringExpenseInput } from "@/lib/validations/recurring";
import { createCreditCard, createInstallmentPlan } from "@/server/services/credit-cards";
import { createRecurringExpense } from "@/server/services/recurring";

import { upsertAdmin } from "./admin";

const today = todayIso();

async function resetBusinessData() {
  await prisma.loan.deleteMany();
  await prisma.person.deleteMany();
  await prisma.recurringExpense.deleteMany();
  await prisma.creditCard.deleteMany();
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
        notes: null,
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
        notes: null,
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
        kind: "AUTO",
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

async function seedCommitments() {
  const visa = await createCreditCard({
    name: "Visa Bancolombia",
    creditLimit: 5_000_000,
    balance: 2_000_000,
    minimumPayment: 200_000,
    paymentAmount: 650_000,
    nextClosingDate: addDaysIso(today, 4),
    nextPaymentDate: addDaysIso(today, 10),
    reminderDays: 5,
    notes: null,
  });
  const master = await createCreditCard({
    name: "Mastercard Davivienda",
    creditLimit: 3_000_000,
    balance: 450_000,
    minimumPayment: 60_000,
    paymentAmount: null,
    nextClosingDate: addDaysIso(today, 12),
    nextPaymentDate: addDaysIso(today, 25),
    reminderDays: 3,
    notes: "Solo para compras en línea",
  });
  await createInstallmentPlan(visa.id, {
    description: "Televisor",
    totalAmount: 1_800_000,
    installmentAmount: 165_000,
    installments: 12,
    paidInstallments: 4,
    startDate: addMonthsIso(today, -4),
    notes: null,
  });
  await createInstallmentPlan(master.id, {
    description: "Tiquetes a Cartagena",
    totalAmount: 900_000,
    installmentAmount: 320_000,
    installments: 3,
    paidInstallments: 1,
    startDate: addMonthsIso(today, -1),
    notes: null,
  });

  const recurring: RecurringExpenseInput[] = [
    { name: "Arriendo", category: "HOUSING", amount: 1_200_000, isVariable: false, frequency: "MONTHLY", nextDueDate: addDaysIso(today, 3), paymentMethod: "BANK_TRANSFER", reminderDays: 7, notes: null },
    { name: "Internet", category: "SERVICES", amount: 120_000, isVariable: false, frequency: "MONTHLY", nextDueDate: addDaysIso(today, 3), paymentMethod: "BANK_TRANSFER", reminderDays: 3, notes: null },
    { name: "Energía", category: "SERVICES", amount: 180_000, isVariable: true, frequency: "MONTHLY", nextDueDate: addDaysIso(today, -2), paymentMethod: "CASH", reminderDays: 3, notes: "Varía según el consumo" },
    { name: "Netflix", category: "SUBSCRIPTIONS", amount: 25_000, isVariable: false, frequency: "MONTHLY", nextDueDate: addDaysIso(today, 6), paymentMethod: "CREDIT_CARD", creditCardId: visa.id, reminderDays: 1, notes: null },
    { name: "Seguro del carro", category: "INSURANCE", amount: 1_400_000, isVariable: false, frequency: "ANNUAL", nextDueDate: addDaysIso(today, 15), paymentMethod: "BANK_TRANSFER", reminderDays: 7, notes: null },
    { name: "Gimnasio", category: "HEALTH", amount: 90_000, isVariable: false, frequency: "MONTHLY", nextDueDate: addDaysIso(today, 20), paymentMethod: "CASH", reminderDays: 3, notes: null },
    { name: "Cuota del carro", category: "DEBT", amount: 850_000, isVariable: false, frequency: "MONTHLY", nextDueDate: addDaysIso(today, 9), paymentMethod: "BANK_TRANSFER", reminderDays: 5, notes: null },
  ];
  for (const input of recurring) await createRecurringExpense(input);
  console.log(`2 tarjetas, 2 compras diferidas y ${recurring.length} gastos recurrentes creados`);
}

async function main() {
  await upsertAdmin();
  // Production: create/refresh the admin only, never touch business data.
  if (process.env.SEED_ONLY_ADMIN === "true") {
    console.log("SEED_ONLY_ADMIN=true: se omiten los datos de ejemplo");
    return;
  }
  await resetBusinessData();
  const personIds = await seedPeople();
  await seedLoans(personIds);
  await seedTransactions();
  await seedCommitments();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
