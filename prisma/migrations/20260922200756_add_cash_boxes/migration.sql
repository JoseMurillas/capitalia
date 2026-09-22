-- CreateEnum
CREATE TYPE "CashBoxMovementKind" AS ENUM ('OPENING', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_DISBURSEMENT', 'LOAN_PAYMENT', 'LOAN_REVERSAL', 'LOAN_REASSIGNMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CashBoxCounterparty" AS ENUM ('PERSONAL_FINANCES', 'EXTERNAL');

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "cashBoxId" TEXT;

-- CreateTable
CREATE TABLE "cash_boxes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_box_movements" (
    "id" TEXT NOT NULL,
    "cashBoxId" TEXT NOT NULL,
    "kind" "CashBoxMovementKind" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "movementDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "counterparty" "CashBoxCounterparty",
    "relatedCashBoxId" TEXT,
    "transferGroupId" TEXT,
    "loanId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_box_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_boxes_name_key" ON "cash_boxes"("name");

-- CreateIndex
CREATE INDEX "cash_boxes_active_name_idx" ON "cash_boxes"("active", "name");

-- CreateIndex
CREATE INDEX "cash_box_movements_cashBoxId_movementDate_idx" ON "cash_box_movements"("cashBoxId", "movementDate");

-- CreateIndex
CREATE INDEX "cash_box_movements_loanId_idx" ON "cash_box_movements"("loanId");

-- CreateIndex
CREATE INDEX "cash_box_movements_transferGroupId_idx" ON "cash_box_movements"("transferGroupId");

-- CreateIndex
CREATE INDEX "loans_cashBoxId_idx" ON "loans"("cashBoxId");

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "cash_boxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_box_movements" ADD CONSTRAINT "cash_box_movements_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "cash_boxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_box_movements" ADD CONSTRAINT "cash_box_movements_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_box_movements" ADD CONSTRAINT "cash_box_movements_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
