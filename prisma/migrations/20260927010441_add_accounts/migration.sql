-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('DEBIT', 'SAVINGS', 'CASH', 'WALLET');

-- CreateEnum
CREATE TYPE "AccountMovementKind" AS ENUM ('OPENING', 'TRANSFER', 'CASH_BOX', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "accountId" TEXT;

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "issuer" TEXT,
    "last4" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_movements" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" "AccountMovementKind" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "movementDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "cashBoxMovementId" TEXT,
    "transferGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_active_name_idx" ON "accounts"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "account_movements_cashBoxMovementId_key" ON "account_movements"("cashBoxMovementId");

-- CreateIndex
CREATE INDEX "account_movements_accountId_movementDate_idx" ON "account_movements"("accountId", "movementDate");

-- CreateIndex
CREATE INDEX "account_movements_transferGroupId_idx" ON "account_movements"("transferGroupId");

-- CreateIndex
CREATE INDEX "transactions_accountId_transactionDate_idx" ON "transactions"("accountId", "transactionDate");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_cashBoxMovementId_fkey" FOREIGN KEY ("cashBoxMovementId") REFERENCES "cash_box_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
