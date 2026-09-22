-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RecurringPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "CreditCardMovementKind" AS ENUM ('CHARGE', 'PAYMENT', 'ADJUSTMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionCategory" ADD VALUE 'SUBSCRIPTIONS';
ALTER TYPE "TransactionCategory" ADD VALUE 'INSURANCE';
ALTER TYPE "TransactionCategory" ADD VALUE 'HEALTH';
ALTER TYPE "TransactionCategory" ADD VALUE 'EDUCATION';
ALTER TYPE "TransactionCategory" ADD VALUE 'DEBT';
ALTER TYPE "TransactionCategory" ADD VALUE 'CREDIT_CARD_PAYMENT';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "recurringExpenseId" TEXT;

-- CreateTable
CREATE TABLE "recurring_expenses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "isVariable" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "RecurringFrequency" NOT NULL,
    "customIntervalDays" INTEGER,
    "nextDueDate" DATE NOT NULL,
    "paymentMethod" "RecurringPaymentMethod" NOT NULL,
    "creditCardId" TEXT,
    "reminderDays" INTEGER NOT NULL DEFAULT 3,
    "lastPaidDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creditLimit" DECIMAL(15,2) NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "minimumPayment" DECIMAL(15,2),
    "paymentAmount" DECIMAL(15,2),
    "nextClosingDate" DATE NOT NULL,
    "nextPaymentDate" DATE NOT NULL,
    "reminderDays" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_installment_plans" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "installmentAmount" DECIMAL(15,2) NOT NULL,
    "installments" INTEGER NOT NULL,
    "paidInstallments" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_movements" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "kind" "CreditCardMovementKind" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "movementDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "recurringExpenseId" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_card_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_expenses_active_nextDueDate_idx" ON "recurring_expenses"("active", "nextDueDate");

-- CreateIndex
CREATE INDEX "recurring_expenses_creditCardId_idx" ON "recurring_expenses"("creditCardId");

-- CreateIndex
CREATE INDEX "credit_cards_active_nextPaymentDate_idx" ON "credit_cards"("active", "nextPaymentDate");

-- CreateIndex
CREATE INDEX "credit_card_installment_plans_creditCardId_idx" ON "credit_card_installment_plans"("creditCardId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_card_movements_transactionId_key" ON "credit_card_movements"("transactionId");

-- CreateIndex
CREATE INDEX "credit_card_movements_creditCardId_movementDate_idx" ON "credit_card_movements"("creditCardId", "movementDate");

-- CreateIndex
CREATE INDEX "transactions_recurringExpenseId_idx" ON "transactions"("recurringExpenseId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "recurring_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_installment_plans" ADD CONSTRAINT "credit_card_installment_plans_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_movements" ADD CONSTRAINT "credit_card_movements_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_movements" ADD CONSTRAINT "credit_card_movements_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "recurring_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_movements" ADD CONSTRAINT "credit_card_movements_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
