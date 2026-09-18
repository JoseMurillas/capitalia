import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "positive" | "negative" | "warning" | "info";

type StatCardProps = {
  title: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  tone?: StatTone;
  className?: string;
};

const iconTone: Record<StatTone, string> = {
  default: "bg-muted text-muted-foreground",
  positive: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  negative: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400",
};

export function StatCard({ title, value, icon: Icon, hint, tone = "default", className }: StatCardProps) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{title}</p>
          <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconTone[tone])}>
            <Icon className="size-4" aria-hidden="true" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
