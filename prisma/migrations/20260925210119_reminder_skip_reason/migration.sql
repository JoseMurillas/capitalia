-- CreateEnum
CREATE TYPE "PaymentReminderSkipReason" AS ENUM ('NO_EMAIL', 'ALREADY_PAID', 'LOAN_CANCELLED', 'STALE');

-- AlterTable
ALTER TABLE "payment_reminders" ADD COLUMN     "skipReason" "PaymentReminderSkipReason";

-- Backfill: until now the reason was inferred from whether an address was captured.
UPDATE "payment_reminders"
SET "skipReason" = CASE WHEN "recipientEmail" IS NULL THEN 'NO_EMAIL'::"PaymentReminderSkipReason"
                        ELSE 'ALREADY_PAID'::"PaymentReminderSkipReason" END
WHERE "status" = 'SKIPPED' AND "skipReason" IS NULL;
