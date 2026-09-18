import type { Metadata } from "next";

import { ReportView } from "@/components/reports/report-view";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { PageHeader } from "@/components/shared/page-header";
import { endOfMonthIso, startOfMonthIso, todayIso } from "@/lib/dates";
import { getIsoDate } from "@/lib/search-params";
import { getReport } from "@/server/queries/reports";

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportsPage({ searchParams }: PageProps<"/reportes">) {
  const params = await searchParams;
  const today = todayIso();
  const fallback = { from: startOfMonthIso(today), to: endOfMonthIso(today) };

  const fromParam = getIsoDate(params, "from");
  const toParam = getIsoDate(params, "to");
  const from = fromParam ?? fallback.from;
  const to = toParam ?? (fromParam ? today : fallback.to);
  const range = from <= to ? { from, to } : { from: to, to: from };

  const report = await getReport(range);

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Resultado del periodo y estado de la cartera."
        actions={<DateRangePicker fallback={fallback} clearable={Boolean(fromParam || toParam)} />}
      />
      <ReportView report={report} />
    </>
  );
}
