import type {
  InstallmentFrequency,
  InstallmentStatus,
  LoanStatus,
  PaymentMethod,
  TransactionCategory,
  TransactionType,
} from "@/generated/prisma/enums";

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
  ENTERTAINMENT: "Entretenimiento",
  OTHER_EXPENSE: "Otros gastos",
};

export const INTEREST_TYPE_LABELS = {
  SIMPLE: "Simple (fijo sobre capital inicial)",
} as const;
