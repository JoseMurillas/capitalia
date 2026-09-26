import type { ReminderKindValue } from "@/lib/calculations/reminders";
import { formatDateLong, type IsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

export type ReminderEmailInput = {
  personName: string;
  installmentNumber: number;
  dueDate: IsoDate;
  /** What is still owed on the installment. */
  amount: number;
  /** What is still owed on the whole loan. */
  loanBalance: number;
  kind: ReminderKindValue;
  daysOverdue: number | null;
  signature: string;
  /** Phone or WhatsApp; null hides the contact line. */
  contact: string | null;
};

function daysLabel(days: number): string {
  return days === 1 ? "1 día" : `${days} días`;
}

export function renderReminderSubject(input: ReminderEmailInput): string {
  if (input.kind === "BEFORE_DUE") return "Recordatorio: tu cuota vence mañana";
  return `Tu cuota está vencida hace ${daysLabel(input.daysOverdue ?? 0)}`;
}

/**
 * Plain text on purpose: no HTML, no images and no links, which is what keeps a
 * personal reminder out of the spam folder. The mailbox does not take replies,
 * so the text says so and offers the contact instead.
 */
export function renderReminderBody(input: ReminderEmailInput): string {
  const opening =
    input.kind === "BEFORE_DUE"
      ? `Te recordamos que la cuota ${input.installmentNumber} de tu préstamo vence el ${formatDateLong(input.dueDate)}.`
      : `La cuota ${input.installmentNumber} de tu préstamo venció el ${formatDateLong(input.dueDate)}, hace ${daysLabel(input.daysOverdue ?? 0)}.`;

  const lines = [
    `Hola ${input.personName},`,
    "",
    opening,
    `Valor a pagar: ${formatMoney(input.amount)}`,
    `Saldo pendiente del préstamo: ${formatMoney(input.loanBalance)}`,
    "",
    "Si ya realizaste el pago, ignora este mensaje.",
    "Este correo se envía automáticamente; no respondas a esta dirección.",
  ];
  if (input.contact) lines.push(`Si necesitas hablar, escríbeme al ${input.contact}.`);
  lines.push("", "Gracias,", input.signature);
  return lines.join("\n");
}
