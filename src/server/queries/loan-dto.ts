import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  InstallmentFrequency,
  InstallmentStatus,
  InterestType,
  LoanStatus,
  PaymentMethod,
} from "@/generated/prisma/enums";
import { summarizeInstallments, toNumber } from "@/lib/calculations";
import { type IsoDate, toIsoDate } from "@/lib/dates";

export const loanSummaryInclude = {
  person: { select: { id: true, name: true } },
  installments: { orderBy: { installmentNumber: "asc" } },
} satisfies Prisma.LoanInclude;

export type LoanWithInstallments = Prisma.LoanGetPayload<{ include: typeof loanSummaryInclude }>;

export type NextInstallmentDto = {
  id: string;
  installmentNumber: number;
  dueDate: IsoDate;
  pendingAmount: number;
  status: InstallmentStatus;
};

/** Everything a list row or a detail header needs about a loan; money as numbers. */
export type LoanSummaryDto = {
  id: string;
  personId: string;
  personName: string;
  principalAmount: number;
  monthlyInterestRate: number;
  interestType: InterestType;
  numberOfInstallments: number;
  installmentFrequency: InstallmentFrequency;
  customIntervalDays: number | null;
  startDate: IsoDate;
  dueDate: IsoDate;
  status: LoanStatus;
  notes: string | null;
  createdAt: string;
  totalInterest: number;
  totalAmount: number;
  totalPaid: number;
  principalPaid: number;
  interestPaid: number;
  principalBalance: number;
  interestBalance: number;
  balance: number;
  nextInstallment: NextInstallmentDto | null;
  paidCount: number;
  overdueCount: number;
};

export type InstallmentDto = {
  id: string;
  installmentNumber: number;
  dueDate: IsoDate;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  principalPaid: number;
  interestPaid: number;
  paidAmount: number;
  pendingAmount: number;
  status: InstallmentStatus;
  paidAt: IsoDate | null;
};

export type PaymentDto = {
  id: string;
  loanId: string;
  personId: string;
  personName: string;
  installmentNumber: number | null;
  amount: number;
  principalPaid: number;
  interestPaid: number;
  paymentDate: IsoDate;
  paymentMethod: PaymentMethod;
  notes: string | null;
  createdAt: string;
};

export function toInstallmentDto(installment: LoanWithInstallments["installments"][number]): InstallmentDto {
  const totalAmount = toNumber(installment.totalAmount);
  const paidAmount = toNumber(installment.paidAmount);
  return {
    id: installment.id,
    installmentNumber: installment.installmentNumber,
    dueDate: toIsoDate(installment.dueDate),
    principalAmount: toNumber(installment.principalAmount),
    interestAmount: toNumber(installment.interestAmount),
    totalAmount,
    principalPaid: toNumber(installment.principalPaid),
    interestPaid: toNumber(installment.interestPaid),
    paidAmount,
    pendingAmount: Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100),
    status: installment.status,
    paidAt: installment.paidAt ? toIsoDate(installment.paidAt) : null,
  };
}

export function toLoanSummaryDto(loan: LoanWithInstallments): LoanSummaryDto {
  const summary = summarizeInstallments(
    loan.installments.map((i) => ({
      id: i.id,
      installmentNumber: i.installmentNumber,
      dueDate: toIsoDate(i.dueDate),
      principalAmount: i.principalAmount,
      interestAmount: i.interestAmount,
      totalAmount: i.totalAmount,
      principalPaid: i.principalPaid,
      interestPaid: i.interestPaid,
      paidAmount: i.paidAmount,
      status: i.status,
    })),
  );

  return {
    id: loan.id,
    personId: loan.person.id,
    personName: loan.person.name,
    principalAmount: toNumber(loan.principalAmount),
    monthlyInterestRate: toNumber(loan.monthlyInterestRate),
    interestType: loan.interestType,
    numberOfInstallments: loan.numberOfInstallments,
    installmentFrequency: loan.installmentFrequency,
    customIntervalDays: loan.customIntervalDays,
    startDate: toIsoDate(loan.startDate),
    dueDate: toIsoDate(loan.dueDate),
    status: loan.status,
    notes: loan.notes,
    createdAt: loan.createdAt.toISOString(),
    totalInterest: toNumber(summary.totalInterest),
    totalAmount: toNumber(summary.totalAmount),
    totalPaid: toNumber(summary.totalPaid),
    principalPaid: toNumber(summary.principalPaid),
    interestPaid: toNumber(summary.interestPaid),
    principalBalance: toNumber(summary.principalBalance),
    interestBalance: toNumber(summary.interestBalance),
    balance: toNumber(summary.balance),
    nextInstallment: summary.nextInstallment
      ? { ...summary.nextInstallment, pendingAmount: Number(summary.nextInstallment.pendingAmount) }
      : null,
    paidCount: summary.paidCount,
    overdueCount: summary.overdueCount,
  };
}

export const paymentInclude = {
  loan: { select: { id: true, person: { select: { id: true, name: true } } } },
  installment: { select: { installmentNumber: true } },
} satisfies Prisma.PaymentInclude;

export type PaymentWithLoan = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

export function toPaymentDto(payment: PaymentWithLoan): PaymentDto {
  return {
    id: payment.id,
    loanId: payment.loan.id,
    personId: payment.loan.person.id,
    personName: payment.loan.person.name,
    installmentNumber: payment.installment?.installmentNumber ?? null,
    amount: toNumber(payment.amount),
    principalPaid: toNumber(payment.principalPaid),
    interestPaid: toNumber(payment.interestPaid),
    paymentDate: toIsoDate(payment.paymentDate),
    paymentMethod: payment.paymentMethod,
    notes: payment.notes,
    createdAt: payment.createdAt.toISOString(),
  };
}
