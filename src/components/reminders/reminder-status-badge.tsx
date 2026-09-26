import { StatusBadge } from "@/components/shared/status-badge";
import { REMINDER_STATUS_LABELS } from "@/lib/labels";
import type { ReminderDto } from "@/server/queries/reminders";

const tones = {
  PENDING: "warning",
  SENT: "success",
  FAILED: "danger",
  SKIPPED: "neutral",
} as const;

export function ReminderStatusBadge({ reminder }: { reminder: ReminderDto }) {
  return <StatusBadge tone={tones[reminder.status]}>{REMINDER_STATUS_LABELS[reminder.status]}</StatusBadge>;
}

/** Says in words why a reminder was never sent, as the run recorded it. */
export function reminderSkipReason(reminder: ReminderDto): string {
  switch (reminder.skipReason) {
    case "NO_EMAIL":
      return `${reminder.personName} no tiene correo registrado`;
    case "ALREADY_PAID":
      return "La cuota se pagó antes de enviarlo";
    case "LOAN_CANCELLED":
      return "El préstamo se canceló antes de enviarlo";
    case "STALE":
      return "Quedó sin enviar tanto tiempo que ya no decía la verdad";
    default:
      return "No se envió";
  }
}
