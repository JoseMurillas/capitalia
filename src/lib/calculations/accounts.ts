import type Decimal from "decimal.js";

import { type MoneyInput, roundMoney, sumMoney, toDecimal, toNumber } from "./money";

export type AccountLedgerInput = {
  /** Signed movements: OPENING, TRANSFER, CASH_BOX, ADJUSTMENT. */
  movements: { amount: MoneyInput }[];
  /** Finance movements assigned to the account. */
  transactions: { type: "INCOME" | "EXPENSE"; amount: MoneyInput }[];
};

/**
 * What the account holds, read from its two sources at once. Nothing is stored,
 * so deleting a movement takes it out of the balance without anything to keep
 * in sync.
 */
export function accountBalance(input: AccountLedgerInput) {
  const fromMovements = sumMoney(input.movements.map((m) => m.amount));
  const fromTransactions = sumMoney(input.transactions.map((t) => transactionLedgerAmount(t.type, t.amount)));
  // Rounded like cashBoxBalance: both ledgers answer the same question and must
  // answer it in the same shape.
  return roundMoney(fromMovements.plus(fromTransactions));
}

/** What every account adds up to. An overdrawn one subtracts; it is not hidden. */
export function accountsTotal(balances: MoneyInput[]) {
  return sumMoney(balances);
}

/**
 * What a cash box operation does to the account the money moves with. Putting
 * capital into a box takes it out of the account; pulling it back puts it in.
 *
 * It lives here, tested, because the alternative is writing the sign by hand at
 * each call site in the cash box service, where getting it backwards would make
 * an account drop when money comes back to it and no test would notice.
 */
export function cashBoxMirrorAmount(operation: "DEPOSIT" | "WITHDRAWAL", amount: MoneyInput) {
  return operation === "DEPOSIT" ? toDecimal(amount).negated() : toDecimal(amount);
}

/** The two halves of a transfer: what leaves one account and what reaches the other. */
export function transferLegs(amount: MoneyInput) {
  return { from: toDecimal(amount).negated(), to: toDecimal(amount) };
}

/**
 * What a finance movement does to the account it belongs to. Written once and
 * used by both the balance and the ledger: if the two ever flipped the sign
 * differently, the balance in the header and the first row of the ledger below
 * it would disagree, and nothing would fail.
 */
export function transactionLedgerAmount(type: "INCOME" | "EXPENSE", amount: MoneyInput) {
  return type === "INCOME" ? toDecimal(amount) : toDecimal(amount).negated();
}

/** `kind` is a plain string so this module stays free of generated imports. */
export type AccountSummaryRow<Kind extends string = string> = {
  kind: Kind;
  active: boolean;
  balance: MoneyInput;
};

export type AccountKindTotal<Kind extends string = string> = {
  kind: Kind;
  total: number;
  count: number;
};

export type AccountsSummaryTotals<Kind extends string = string> = {
  total: number;
  byKind: AccountKindTotal<Kind>[];
};

/**
 * What the accounts add up to. An inactive account keeps its history but is not
 * money you can spend, so it stays out of the total and out of its group.
 * Returns numbers because this feeds a DTO.
 */
export function summarizeAccounts<Kind extends string>(
  rows: readonly AccountSummaryRow<Kind>[],
): AccountsSummaryTotals<Kind> {
  const active = rows.filter((row) => row.active);
  // Balances are grouped before being added, so every sum stays a Decimal sum.
  const byKind = new Map<Kind, MoneyInput[]>();
  for (const row of active) {
    byKind.set(row.kind, [...(byKind.get(row.kind) ?? []), row.balance]);
  }

  return {
    total: toNumber(accountsTotal(active.map((row) => row.balance))),
    byKind: [...byKind].map(([kind, balances]) => ({
      kind,
      total: toNumber(accountsTotal(balances)),
      count: balances.length,
    })),
  };
}

/**
 * Which of the two definitions of "available" the Resumen is entitled to use.
 * `ACCOUNTS` is the sum of what the accounts actually hold; `ESTIMATE` is the
 * global cash formula, which needs no accounts to exist.
 */
export type AvailableMoneyBasis = "ACCOUNTS" | "ESTIMATE";

export type AvailableMoneyInput = {
  /** Accounts that are active right now. Zero means their sum means nothing. */
  activeAccountCount: number;
  /** Sum of the active accounts' balances (`summarizeAccounts().total`). */
  accountsTotal: MoneyInput;
  /** Global cash position: income − expenses − deposits into boxes + withdrawals. */
  cashPosition: MoneyInput;
  /** What the month still owes: recurring plus card payments pending. */
  reserveNeeded: MoneyInput;
  /** The month-scoped estimate shown while there are no accounts. */
  monthEstimate: MoneyInput;
};

export type AvailableMoney = {
  basis: AvailableMoneyBasis;
  /** What you have right now. */
  cashAvailable: Decimal;
  /** What is left of it once this month's commitments are covered. */
  estimatedAvailable: Decimal;
};

/**
 * Picks the formula the Resumen shows for the money you have available, and
 * derives both figures from the one it picked so the two cards cannot disagree.
 *
 * With no active account the sum of the accounts is zero, and zero is not "you
 * have no money": it is "nobody has written down where the money is". Showing
 * it would be an exact number that is false, which is worse than the
 * approximation the app showed before accounts existed — so the estimate stays
 * until there is at least one active account to add up. An account that exists
 * but is deactivated does not count: it is history, not spendable money, and
 * `summarizeAccounts` already leaves it out of the total.
 *
 * It lives here, tested, because it is a business rule about which number the
 * user is told, not a detail of how a query is written.
 */
export function availableMoney(input: AvailableMoneyInput): AvailableMoney {
  if (input.activeAccountCount < 1) {
    return {
      basis: "ESTIMATE",
      cashAvailable: roundMoney(input.cashPosition),
      estimatedAvailable: roundMoney(input.monthEstimate),
    };
  }

  const total = toDecimal(input.accountsTotal);
  return {
    basis: "ACCOUNTS",
    cashAvailable: roundMoney(total),
    // Never clamped at zero: owing more this month than you hold is exactly the
    // thing this card exists to tell you.
    estimatedAvailable: roundMoney(total.minus(toDecimal(input.reserveNeeded))),
  };
}
