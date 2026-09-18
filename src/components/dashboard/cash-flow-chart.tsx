"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatMonth } from "@/lib/dates";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import type { MonthlyCashFlowPoint } from "@/server/queries/dashboard";

const config = {
  income: { label: "Ingresos", color: "var(--chart-1)" },
  expense: { label: "Gastos", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function CashFlowChart({ data }: { data: MonthlyCashFlowPoint[] }) {
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} barGap={2} barCategoryGap="30%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="0" className="stroke-border" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: string) => formatMonth(value)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatMonth(String(value))}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{config[name as keyof typeof config].label}</span>
                  <span className="font-medium tabular-nums">{formatMoney(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  );
}
