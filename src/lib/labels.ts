import type {
  CreditCardMovementKind,
  InstallmentFrequency,
  InstallmentStatus,
  LoanStatus,
  PaymentKind,
  PaymentMethod,
  RecurringFrequency,
  RecurringPaymentMethod,
  TransactionCategory,
  TransactionType,
} from "@/generated/prisma/enums";
import type { CommitmentStatus } from "@/lib/calculations/commitments";

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  ACTIVE: "Activo",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
};

export const FREQUENCY_LABELS: Record<InstallmentFrequency, string> = {
  MONTHLY: "Mensual",
  BIWEEKLY: "Quincenal",
  WEEKLY: "Semanal",
  CUSTOM: "Personalizada",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  OTHER: "Otro",
};

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  AUTO: "Automático",
  INTEREST_ONLY: "Solo intereses",
  PRINCIPAL: "Abono a capital",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
};

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  SALARY: "Salario",
  LOAN_INTEREST: "Intereses de préstamos",
  OTHER_INCOME: "Otros ingresos",
  FOOD: "Alimentación",
  TRANSPORT: "Transporte",
  HOUSING: "Vivienda",
  SERVICES: "Servicios",
  SUBSCRIPTIONS: "Suscripciones",
  ENTERTAINMENT: "Entretenimiento",
  INSURANCE: "Seguros",
  HEALTH: "Salud y bienestar",
  EDUCATION: "Educación",
  DEBT: "Deudas y créditos",
  CREDIT_CARD_PAYMENT: "Pago de tarjeta de crédito",
  OTHER_EXPENSE: "Otros gastos",
};

export const INTEREST_TYPE_LABELS = {
  SIMPLE: "Simple (fijo sobre capital inicial)",
} as const;

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  CUSTOM: "Personalizada",
};

export const RECURRING_PAYMENT_METHOD_LABELS: Record<RecurringPaymentMethod, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia / débito",
  CREDIT_CARD: "Tarjeta de crédito",
  OTHER: "Otro",
};

export const CARD_MOVEMENT_KIND_LABELS: Record<CreditCardMovementKind, string> = {
  CHARGE: "Cargo",
  PAYMENT: "Pago",
  ADJUSTMENT: "Ajuste",
};

export const COMMITMENT_STATUS_LABELS: Record<CommitmentStatus, string> = {
  OVERDUE: "Vencido",
  DUE_TODAY: "Vence hoy",
  ALERT: "Pronto",
  UPCOMING: "Programado",
};

/** "Vence en 3 días", "Vence hoy", "Venció hace 2 días". */
export function dueInLabel(daysUntilDue: number): string {
  if (daysUntilDue < -1) return `Venció hace ${-daysUntilDue} días`;
  if (daysUntilDue === -1) return "Venció ayer";
  if (daysUntilDue === 0) return "Vence hoy";
  if (daysUntilDue === 1) return "Vence mañana";
  return `Vence en ${daysUntilDue} días`;
}
