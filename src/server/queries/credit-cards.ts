import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { CreditCardMovementKind } from "@/generated/prisma/enums";
import {
  cardAvailable,
  cardUtilization,
  type CommitmentStatus,
  commitmentStatus,
  installmentsThisMonth,
  planRemaining,
  suggestedPayment,
  sumMoney,
  toNumber,
} from "@/lib/calculations";
import { endOfMonthIso, type IsoDate, todayIso, toIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth";

export type CreditCardDto = {
  id: string;
  name: string;
  creditLimit: number;
  balance: number;
  available: number;
  /** Percentage of the limit in use (40 = 40 %). */
  utilization: number;
  minimumPayment: number | null;
  paymentAmount: number | null;
  /** paymentAmount ?? minimumPayment ?? 0 */
  suggestedPayment: number;
  nextClosingDate: IsoDate;
  nextPaymentDate: IsoDate;
  daysUntilPayment: number;
  status: CommitmentStatus;
  reminderDays: number;
  active: boolean;
  notes: string | null;
  installmentsThisMonth: number;
  activePlans: number;
};

export type CreditCardOption = { id: string; name: string };

export type InstallmentPlanDto = {
  id: string;
  creditCardId: string;
  description: string;
  totalAmount: number;
  installmentAmount: number;
  installments: number;
  paidInstallments: number;
  remainingInstallments: number;
  remainingAmount: number;
  finished: boolean;
  startDate: IsoDate;
  notes: string | null;
};

export type CardMovementDto = {
  id: string;
  kind: CreditCardMovementKind;
  amount: number;
  movementDate: IsoDate;
  description: string;
  recurringExpenseId: string | null;
  transactionId: string | null;
};

export type CreditCardDetailDto = CreditCardDto & { plans: InstallmentPlanDto[]; movements: CardMovementDto[] };

export type CreditCardsSummary = {
  count: number;
  totalLimit: number;
  totalDebt: number;
  totalAvailable: number;
  /** Suggested payments of active cards whose payment date falls in the current month. */
  paymentsThisMonth: number;
};

const cardInclude = {
  installmentPlans: { select: { installments: true, paidInstallments: true, installmentAmount: true } },
} satisfies Prisma.CreditCardInclude;

type CardRow = Prisma.CreditCardGetPayload<{ include: typeof cardInclude }>;

const MOVEMENTS_LIMIT = 50;

function toCardDto(card: CardRow, today: IsoDate): CreditCardDto {
  const nextPaymentDate = toIsoDate(card.nextPaymentDate);
  const { status, daysUntilDue } = commitmentStatus(today, nextPaymentDate, card.reminderDays);
  return {
    id: card.id,
    name: card.name,
    creditLimit: toNumber(card.creditLimit),
    balance: toNumber(card.balance),
    available: toNumber(cardAvailable(card.creditLimit, card.balance)),
    utilization: cardUtilization(card.creditLimit, card.balance),
    minimumPayment: card.minimumPayment === null ? null : toNumber(card.minimumPayment),
    paymentAmount: card.paymentAmount === null ? null : toNumber(card.paymentAmount),
    suggestedPayment: toNumber(suggestedPayment(card.paymentAmount, card.minimumPayment)),
    nextClosingDate: toIsoDate(card.nextClosingDate),
    nextPaymentDate,
    daysUntilPayment: daysUntilDue,
    status,
    reminderDays: card.reminderDays,
    active: card.active,
    notes: card.notes,
    installmentsThisMonth: toNumber(installmentsThisMonth(card.installmentPlans)),
    activePlans: card.installmentPlans.filter((plan) => !planRemaining(plan).finished).length,
  };
}

function toPlanDto(plan: Prisma.CreditCardInstallmentPlanGetPayload<object>): InstallmentPlanDto {
  const remaining = planRemaining(plan);
  return {
    id: plan.id,
    creditCardId: plan.creditCardId,
    description: plan.description,
    totalAmount: toNumber(plan.totalAmount),
    installmentAmount: toNumber(plan.installmentAmount),
    installments: plan.installments,
    paidInstallments: plan.paidInstallments,
    remainingInstallments: remaining.remainingInstallments,
    remainingAmount: toNumber(remaining.remainingAmount),
    finished: remaining.finished,
    startDate: toIsoDate(plan.startDate),
    notes: plan.notes,
  };
}

function toMovementDto(m: Prisma.CreditCardMovementGetPayload<object>): CardMovementDto {
  return {
    id: m.id,
    kind: m.kind,
    amount: toNumber(m.amount),
    movementDate: toIsoDate(m.movementDate),
    description: m.description,
    recurringExpenseId: m.recurringExpenseId,
    transactionId: m.transactionId,
  };
}

export async function listCreditCards(): Promise<CreditCardDto[]> {
  await requireSession();
  const today = todayIso();
  const cards = await prisma.creditCard.findMany({
    include: cardInclude,
    orderBy: [{ active: "desc" }, { nextPaymentDate: "asc" }, { name: "asc" }],
  });
  return cards.map((card) => toCardDto(card, today));
}

export async function listCreditCardOptions(): Promise<CreditCardOption[]> {
  await requireSession();
  return prisma.creditCard.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getCreditCardDetail(id: string): Promise<CreditCardDetailDto | null> {
  await requireSession();
  const today = todayIso();
  const card = await prisma.creditCard.findUnique({
    where: { id },
    include: {
      ...cardInclude,
      movements: { orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }], take: MOVEMENTS_LIMIT },
    },
  });
  if (!card) return null;
  const plans = await prisma.creditCardInstallmentPlan.findMany({
    where: { creditCardId: id },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  return {
    ...toCardDto(card, today),
    plans: plans.map(toPlanDto),
    movements: card.movements.map(toMovementDto),
  };
}

export async function getCreditCardsSummary(): Promise<CreditCardsSummary> {
  const cards = (await listCreditCards()).filter((card) => card.active);
  const monthEnd = endOfMonthIso(todayIso());
  return {
    count: cards.length,
    totalLimit: toNumber(sumMoney(cards.map((c) => c.creditLimit))),
    totalDebt: toNumber(sumMoney(cards.map((c) => c.balance))),
    totalAvailable: toNumber(sumMoney(cards.map((c) => c.available))),
    paymentsThisMonth: toNumber(
      sumMoney(cards.filter((c) => c.nextPaymentDate <= monthEnd).map((c) => c.suggestedPayment)),
    ),
  };
}
