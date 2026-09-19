-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('AUTO', 'INTEREST_ONLY', 'PRINCIPAL');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "kind" "PaymentKind" NOT NULL DEFAULT 'AUTO';
