-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InterestType" AS ENUM ('SIMPLE');

-- CreateEnum
CREATE TYPE "InstallmentFrequency" AS ENUM ('MONTHLY', 'BIWEEKLY', 'WEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('SALARY', 'LOAN_INTEREST', 'OTHER_INCOME', 'FOOD', 'TRANSPORT', 'HOUSING', 'SERVICES', 'ENTERTAINMENT', 'OTHER_EXPENSE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "document" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "principalAmount" DECIMAL(15,2) NOT NULL,
    "monthlyInterestRate" DECIMAL(6,3) NOT NULL,
    "interestType" "InterestType" NOT NULL DEFAULT 'SIMPLE',
    "numberOfInstallments" INTEGER NOT NULL,
    "installmentFrequency" "InstallmentFrequency" NOT NULL,
    "customIntervalDays" INTEGER,
    "startDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "principalAmount" DECIMAL(15,2) NOT NULL,
    "interestAmount" DECIMAL(15,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "principalPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "interestPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" DATE,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "principalPaid" DECIMAL(15,2) NOT NULL,
    "interestPaid" DECIMAL(15,2) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "principalPaid" DECIMAL(15,2) NOT NULL,
    "interestPaid" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" TEXT NOT NULL,
    "transactionDate" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "people_document_key" ON "people"("document");

-- CreateIndex
CREATE INDEX "people_name_idx" ON "people"("name");

-- CreateIndex
CREATE INDEX "loans_personId_idx" ON "loans"("personId");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE INDEX "loans_dueDate_idx" ON "loans"("dueDate");

-- CreateIndex
CREATE INDEX "installments_dueDate_status_idx" ON "installments"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "installments_loanId_installmentNumber_key" ON "installments"("loanId", "installmentNumber");

-- CreateIndex
CREATE INDEX "payments_loanId_idx" ON "payments"("loanId");

-- CreateIndex
CREATE INDEX "payments_paymentDate_idx" ON "payments"("paymentDate");

-- CreateIndex
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "payment_allocations_installmentId_idx" ON "payment_allocations"("installmentId");

-- CreateIndex
CREATE INDEX "transactions_transactionDate_idx" ON "transactions"("transactionDate");

-- CreateIndex
CREATE INDEX "transactions_type_category_idx" ON "transactions"("type", "category");

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
