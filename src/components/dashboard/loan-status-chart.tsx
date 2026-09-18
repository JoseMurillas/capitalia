"use client";

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LOAN_STATUS_LABELS } from "@/lib/labels";
import type { LoanStatusPoint } from "@/server/queries/dashboard";

// Status is the encoding here, so each bar takes its status colour; the label
// beside every bar keeps identity readable without relying on hue.
const config = {
  count: { label: "Préstamos" },
  ACTIVE: { label: LOAN_STATUS_LABELS.ACTIVE, color: "var(--chart-4)" },
  PAID: { label: LOAN_STATUS_LABELS.PAID, color: "var(--chart-1)" },
  OVERDUE: { label: LOAN_STATUS_LABELS.OVERDUE, color: "var(--chart-2)" },
} satisfies ChartConfig;

export function LoanStatusChart({ data }: { data: LoanStatusPoint[] }) {
  const rows = data.map((point) => ({ ...point, label: LOAN_STATUS_LABELS[point.status] }));

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={rows} layout="vertical" barCategoryGap="30%" margin={{ top: 8, right: 40, left: 0, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={80}
          tickMargin={8}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value, _name, item) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{item.payload.label}</span>
                  <span className="font-medium tabular-nums">
                    {Number(value)} préstamo{Number(value) === 1 ? "" : "s"}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {rows.map((row) => (
            <Cell key={row.status} fill={`var(--color-${row.status})`} />
          ))}
          <LabelList dataKey="count" position="right" offset={8} className="fill-foreground text-xs tabular-nums" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
