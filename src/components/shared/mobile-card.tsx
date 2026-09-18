import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type MobileCardMeta = { label: string; value: React.ReactNode };

type MobileCardProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Headline figure shown on the right, usually money. */
  value?: React.ReactNode;
  badge?: React.ReactNode;
  /** Secondary label/value pairs laid out in two columns. */
  meta?: MobileCardMeta[];
  /** Tapping the card navigates here (an actions menu can still sit on top). */
  href?: string;
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Phone-sized replacement for a table row: everything a row shows, stacked so
 * it can be read and tapped with one hand. Rendered by DataTable below `md`.
 */
export function MobileCard({ title, subtitle, value, badge, meta, href, actions, className }: MobileCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{title}</div>
          {subtitle ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {value ? <div className="font-semibold tabular-nums">{value}</div> : null}
          {badge}
        </div>
      </div>
      {meta && meta.length > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {meta.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between gap-2 border-t pt-1.5">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="text-right font-medium tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );

  const rightPadding = actions ? "pr-12" : href ? "pr-9" : "";

  return (
    <div className={cn("relative rounded-lg border bg-card", className)}>
      {href ? (
        <Link href={href} className={cn("block p-3 active:bg-muted/50", rightPadding)}>
          {body}
          {!actions ? (
            <ChevronRight className="absolute top-3 right-2 size-4 text-muted-foreground" aria-hidden="true" />
          ) : null}
        </Link>
      ) : (
        <div className={cn("p-3", rightPadding)}>{body}</div>
      )}
      {actions ? <div className="absolute top-2 right-2">{actions}</div> : null}
    </div>
  );
}
