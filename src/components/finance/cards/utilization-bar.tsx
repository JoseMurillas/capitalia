import { Progress } from "@/components/ui/progress";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** ≤ 30 % healthy, ≤ 70 % watch, above that the card is close to its limit. */
function toneClass(value: number): string {
  if (value <= 30) return "[&>[data-slot=progress-indicator]]:bg-emerald-500";
  if (value <= 70) return "[&>[data-slot=progress-indicator]]:bg-amber-500";
  return "[&>[data-slot=progress-indicator]]:bg-red-500";
}

export function UtilizationBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Progress
        value={Math.min(value, 100)}
        aria-label={`Utilización ${formatPercent(value)}`}
        className={cn("h-2", toneClass(value))}
      />
      <span className={cn("w-12 text-right text-xs font-medium tabular-nums", value > 100 && "text-red-600 dark:text-red-400")}>
        {formatPercent(value)}
      </span>
    </div>
  );
}
