-- AlterTable
ALTER TABLE "recurring_expenses" ADD COLUMN     "accountId" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "accounts_name_key" ON "accounts"("name");
-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
