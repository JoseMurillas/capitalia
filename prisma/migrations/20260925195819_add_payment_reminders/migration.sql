-- CreateEnum
CREATE TYPE "PaymentReminderKind" AS ENUM ('BEFORE_DUE', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "payment_reminders" (
    "id" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "kind" "PaymentReminderKind" NOT NULL,
    "scheduledFor" DATE NOT NULL,
    "status" "PaymentReminderStatus" NOT NULL DEFAULT 'PENDING',
    "recipientEmail" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "subject" TEXT NOT NULL,
    "daysOverdue" INTEGER,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_reminders_status_scheduledFor_idx" ON "payment_reminders"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "payment_reminders_scheduledFor_idx" ON "payment_reminders"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reminders_installmentId_kind_scheduledFor_key" ON "payment_reminders"("installmentId", "kind", "scheduledFor");

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
