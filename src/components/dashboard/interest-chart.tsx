"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatMonth } from "@/lib/dates";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import type { MonthlyInterestPoint } from "@/server/queries/dashboard";

const config = {
  interest: { label: "Intereses cobrados", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function InterestChart({ data }: { data: MonthlyInterestPoint[] }) {
  const maxIndex = data.reduce((best, point, index) => (point.interest > data[best].interest ? index : best), 0);

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} barCategoryGap="35%" margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} className="stroke-border" />
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
              hideIndicator
              labelFormatter={(value) => formatMonth(String(value))}
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">Intereses</span>
                  <span className="font-medium tabular-nums">{formatMoney(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="interest" fill="var(--color-interest)" radius={[4, 4, 0, 0]} maxBarSize={24}>
          {/* Direct-label only the best month; the axis and tooltip carry the rest. */}
          <LabelList
            position="top"
            offset={6}
            className="fill-foreground text-xs tabular-nums"
            valueAccessor={(_entry, index) =>
              index === maxIndex && data[index].interest > 0 ? formatMoneyCompact(data[index].interest) : ""
            }
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
