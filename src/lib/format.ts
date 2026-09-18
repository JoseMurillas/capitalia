const LOCALE = "es-CO";

const integerFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Formats a COP amount the way it is written in Colombia: `$1.000.000`.
 * Negative values are rendered as `-$120.000`.
 */
export function formatMoney(value: number | string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "$0";
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${integerFormatter.format(Math.abs(amount))}`;
}

/** Formats a plain number with Colombian thousands separators (no currency sign). */
export function formatNumber(value: number | string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "0";
  return decimalFormatter.format(amount);
}

/** Formats a percentage stored as a plain number (12 → `12%`, 2.5 → `2,5%`). */
export function formatPercent(value: number | string): string {
  const rate = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(rate)) return "0%";
  return `${decimalFormatter.format(rate)}%`;
}

/** Compact money for charts and tight spaces: `$1,2M`, `$120K`. */
export function formatMoneyCompact(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${decimalFormatter.format(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}$${integerFormatter.format(abs / 1_000)}K`;
  return `${sign}$${integerFormatter.format(abs)}`;
}
