import "server-only";

import type { RecurringPaymentMethod, TransactionCategory } from "@/generated/prisma/enums";
import {
  buildMonthPlan,
  type CommitmentStatus,
  filterUpcoming,
  isAlertActive,
  sumMoney,
  toNumber,
} from "@/lib/calculations";
import { type IsoDate, todayIso } from "@/lib/dates";
import { requireSession } from "@/server/auth";

import { type CreditCardDto, listCreditCards } from "./credit-cards";
import { listRecurringExpenses, type RecurringExpenseDto, type RecurringSummary } from "./recurring";
import { getFinanceSummary } from "./transactions";

type CommitmentBase = {
  id: string;
  name: string;
  amount: number;
  dueDate: IsoDate;
  daysUntilDue: number;
  status: CommitmentStatus;
};

/** One thing the user has to pay: a recurring expense or a credit-card statement. */
export type CommitmentDto =
  | (CommitmentBase & {
      kind: "RECURRING";
      category: TransactionCategory;
      paymentMethod: RecurringPaymentMethod;
      creditCardName: string | null;
      isVariable: boolean;
    })
  | (CommitmentBase & { kind: "CARD"; balance: number; suggestedPayment: number });

export type UpcomingCommitments = { items: CommitmentDto[]; total: number; horizonDays: number };

export type CommitmentsOverview = {
  today: IsoDate;
  monthIncome: number;
  monthExpense: number;
  /** Cash position (income − expenses − deposits into boxes + withdrawals from boxes); never includes card limits. */
  cashAvailable: number;
  recurringPending: number;
  cardPending: number;
  reserveNeeded: number;
  estimatedAvailable: number;
  monthlyCommitted: number;
  activeRecurringCount: number;
  alerts: CommitmentDto[];
  upcoming: UpcomingCommitments;
  recurringSummary: RecurringSummary;
  cards: CreditCardDto[];
};

export const DASHBOARD_HORIZON_DAYS = 14;
export const OVERVIEW_HORIZON_DAYS = 30;

function toCommitments(recurring: RecurringExpenseDto[], cards: CreditCardDto[]): CommitmentDto[] {
  return [
    ...recurring.map<CommitmentDto>((r) => ({
      kind: "RECURRING",
      id: r.id,
      name: r.name,
      amount: r.amount,
      dueDate: r.nextDueDate,
      daysUntilDue: r.daysUntilDue,
      status: r.status,
      category: r.category,
      paymentMethod: r.paymentMethod,
      creditCardName: r.creditCardName,
      isVariable: r.isVariable,
    })),
    ...cards.map<CommitmentDto>((c) => ({
      kind: "CARD",
      id: c.id,
      name: c.name,
      amount: c.suggestedPayment,
      dueDate: c.nextPaymentDate,
      daysUntilDue: c.daysUntilPayment,
      status: c.status,
      balance: c.balance,
      suggestedPayment: c.suggestedPayment,
    })),
  ];
}

function upcomingWithin(commitments: CommitmentDto[], horizonDays: number): UpcomingCommitments {
  const items = filterUpcoming(commitments, horizonDays);
  return { items, total: toNumber(sumMoney(items.map((i) => i.amount))), horizonDays };
}

async function loadActive() {
  const [recurring, allCards] = await Promise.all([listRecurringExpenses({ status: "active" }), listCreditCards()]);
  const cards = allCards.filter((card) => card.active);
  return { recurring, cards, commitments: toCommitments(recurring, cards) };
}

export async function getUpcomingCommitments(horizonDays = DASHBOARD_HORIZON_DAYS): Promise<UpcomingCommitments> {
  await requireSession();
  const { commitments } = await loadActive();
  return upcomingWithin(commitments, horizonDays);
}

export async function getCommitmentsOverview(): Promise<CommitmentsOverview> {
  await requireSession();
  const today = todayIso();
  const [{ recurring, cards, commitments }, finance] = await Promise.all([loadActive(), getFinanceSummary()]);

  const plan = buildMonthPlan({
    today,
    monthIncome: finance.monthIncome,
    monthExpense: finance.monthExpense,
    recurring,
    cards,
  });
  const upcoming = upcomingWithin(commitments, OVERVIEW_HORIZON_DAYS);

  return {
    today,
    monthIncome: finance.monthIncome,
    monthExpense: finance.monthExpense,
    cashAvailable: finance.available,
    recurringPending: toNumber(plan.recurringPending),
    cardPending: toNumber(plan.cardPending),
    reserveNeeded: toNumber(plan.reserveNeeded),
    estimatedAvailable: toNumber(plan.estimatedAvailable),
    monthlyCommitted: toNumber(plan.monthlyCommitted),
    activeRecurringCount: recurring.length,
    // Alerts follow each item's own reminder window (up to 60 days), not the 30-day list horizon.
    alerts: filterUpcoming(commitments.filter((c) => isAlertActive(c.status)), Number.POSITIVE_INFINITY),
    upcoming,
    recurringSummary: {
      activeCount: recurring.length,
      monthlyCommitted: toNumber(plan.monthlyCommitted),
      byCategory: plan.byCategory.map((c) => ({
        category: c.category as TransactionCategory,
        monthly: toNumber(c.monthly),
        count: c.count,
      })),
      alertCount: recurring.filter((r) => isAlertActive(r.status)).length,
    },
    cards,
  };
}
