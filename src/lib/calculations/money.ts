import Decimal from "decimal.js";

/**
 * All money math in the app goes through this module so rounding is uniform:
 * two decimals, half-up, as accountants expect for COP amounts.
 */
/** Objects such as Prisma's Decimal that are not instances of our decimal.js class. */
export type DecimalLike = { toFixed(decimalPlaces?: number): string; toNumber(): number };

export type MoneyInput = Decimal.Value | DecimalLike;

export const ZERO = new Decimal(0);

export function toDecimal(value: MoneyInput): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "object" && value !== null) return new Decimal(value.toFixed());
  return new Decimal(value);
}

export function roundMoney(value: MoneyInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function sumMoney(values: readonly MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, value) => acc.plus(toDecimal(value)), ZERO);
}

export function maxMoney(a: MoneyInput, b: MoneyInput): Decimal {
  return Decimal.max(toDecimal(a), toDecimal(b));
}

export function minMoney(a: MoneyInput, b: MoneyInput): Decimal {
  return Decimal.min(toDecimal(a), toDecimal(b));
}

/** Serialises a Decimal for the client (presentation only). */
export function toNumber(value: MoneyInput): number {
  return toDecimal(value).toNumber();
}

/** Serialises a Decimal for Prisma writes. */
export function toDbString(value: MoneyInput): string {
  return roundMoney(value).toFixed(2);
}
