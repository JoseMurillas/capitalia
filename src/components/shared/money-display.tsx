import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export type MoneyTone = "neutral" | "positive" | "negative" | "muted";

type MoneyDisplayProps = {
  value: number;
  tone?: MoneyTone;
  compact?: boolean;
  /** Prefix a sign for positive values, useful in ledgers (+$120.000). */
  signed?: boolean;
  className?: string;
};

const toneClasses: Record<MoneyTone, string> = {
  neutral: "",
  positive: "text-emerald-700 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  muted: "text-muted-foreground",
};

export function MoneyDisplay({
  value,
  tone = "neutral",
  compact = false,
  signed = false,
  className,
}: MoneyDisplayProps) {
  const formatted = compact ? formatMoneyCompact(value) : formatMoney(value);
  const text = signed && value > 0 ? `+${formatted}` : formatted;

  return (
    <span className={cn("tabular-nums", toneClasses[tone], className)}>
      {text}
    </span>
  );
}
