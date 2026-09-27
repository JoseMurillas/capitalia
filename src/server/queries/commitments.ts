import "server-only";

import type { RecurringPaymentMethod, TransactionCategory } from "@/generated/prisma/enums";
import {
  availableMoney,
  type AvailableMoneyBasis,
  buildMonthPlan,
  type CommitmentStatus,
  filterUpcoming,
  isAlertActive,
  sumMoney,
  toNumber,
} from "@/lib/calculations";
import { type IsoDate, todayIso } from "@/lib/dates";
import { requireSession } from "@/server/auth";

import { getAccountsSummary } from "./accounts";
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
      /** Usual account, so paying from the alert list proposes it too. */
      accountId: string | null;
    })
  | (CommitmentBase & { kind: "CARD"; balance: number; suggestedPayment: number });

export type UpcomingCommitments = { items: CommitmentDto[]; total: number; horizonDays: number };

export type CommitmentsOverview = {
  today: IsoDate;
  monthIncome: number;
  monthExpense: number;
  /**
   * The money you have: the sum of the active accounts once there is at least
   * one, and the global cash position (income − expenses − deposits into boxes +
   * withdrawals from boxes) while there is none. Never includes card limits.
   */
  cashAvailable: number;
  /** Which of the two the two figures above and below came from. */
  availableBasis: AvailableMoneyBasis;
  recurringPending: number;
  cardPending: number;
  reserveNeeded: number;
  estimatedAvailable: number;
  monthlyCommitted: number;
  activeRecurringCount: number;
  /** Finance movements still without an account, so the Resumen can warn too (spec §4.2). */
  unassignedCount: number;
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
      accountId: r.accountId,
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
  const [{ recurring, cards, commitments }, finance, accounts] = await Promise.all([
    loadActive(),
    getFinanceSummary(),
    getAccountsSummary(),
  ]);

  const plan = buildMonthPlan({
    today,
    monthIncome: finance.monthIncome,
    monthExpense: finance.monthExpense,
    recurring,
    cards,
  });
  const upcoming = upcomingWithin(commitments, OVERVIEW_HORIZON_DAYS);
  // Which formula the two «disponible» cards are entitled to use is a business
  // rule, so it is decided by a tested function and not by an `if` in here.
  const available = availableMoney({
    activeAccountCount: accounts.activeCount,
    accountsTotal: accounts.total,
    cashPosition: finance.available,
    reserveNeeded: plan.reserveNeeded,
    monthEstimate: plan.estimatedAvailable,
  });

  return {
    today,
    monthIncome: finance.monthIncome,
    monthExpense: finance.monthExpense,
    cashAvailable: toNumber(available.cashAvailable),
    availableBasis: available.basis,
    recurringPending: toNumber(plan.recurringPending),
    cardPending: toNumber(plan.cardPending),
    reserveNeeded: toNumber(plan.reserveNeeded),
    estimatedAvailable: toNumber(available.estimatedAvailable),
    monthlyCommitted: toNumber(plan.monthlyCommitted),
    activeRecurringCount: recurring.length,
    unassignedCount: accounts.unassignedCount,
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
