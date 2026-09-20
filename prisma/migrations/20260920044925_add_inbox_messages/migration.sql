-- CreateEnum
CREATE TYPE "InboxSource" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "InboxDirection" AS ENUM ('INCOME', 'EXPENSE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" TEXT NOT NULL,
    "source" "InboxSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "sender" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "InboxStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(15,2),
    "direction" "InboxDirection" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT,
    "suggestedDate" DATE,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_messages_transactionId_key" ON "inbox_messages"("transactionId");

-- CreateIndex
CREATE INDEX "inbox_messages_status_receivedAt_idx" ON "inbox_messages"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_messages_source_externalId_key" ON "inbox_messages"("source", "externalId");

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
