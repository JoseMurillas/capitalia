import { ChartSkeleton, PageHeaderSkeleton, StatCardsSkeleton } from "@/components/shared/loading-state";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={8} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartSkeleton />
        </div>
        <ChartSkeleton />
      </div>
    </div>
  );
}
