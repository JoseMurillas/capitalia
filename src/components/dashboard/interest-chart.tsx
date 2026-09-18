"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatMonth, formatMonthShort } from "@/lib/dates";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import type { MonthlyInterestPoint } from "@/server/queries/dashboard";

const config = {
  interest: { label: "Intereses cobrados", color: "var(--chart-1)" },
} satisfies ChartConfig;

type PeakLabelProps = React.ComponentProps<typeof LabelList>["content"] extends
  | React.ReactElement
  | ((props: infer P) => unknown)
  | undefined
  ? P
  : never;

export function InterestChart({ data }: { data: MonthlyInterestPoint[] }) {
  const maxIndex = data.reduce((best, point, index) => (point.interest > data[best].interest ? index : best), 0);
  const hasValues = data.some((point) => point.interest > 0);

  // Only the best month gets a direct label; the axis and tooltip carry the rest.
  // Recharts hands the bar's box as `viewBox`; the label sits centred above it.
  const renderPeakLabel = ({ viewBox, value, index }: PeakLabelProps) => {
    if (!hasValues || index !== maxIndex || !viewBox || !("x" in viewBox)) return null;
    const { x = 0, y = 0, width = 0 } = viewBox;
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        className="fill-foreground text-xs tabular-nums"
      >
        {formatMoneyCompact(Number(value))}
      </text>
    );
  };

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} barCategoryGap="35%" margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} className="stroke-border" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          tickFormatter={(value: string) => formatMonthShort(value)}
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
          <LabelList dataKey="interest" content={renderPeakLabel} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
