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
