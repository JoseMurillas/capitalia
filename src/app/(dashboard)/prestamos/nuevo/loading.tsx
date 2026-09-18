import { PageHeaderSkeleton } from "@/components/shared/loading-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewLoanLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-[32rem] w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
