import { LoadingState } from "@/components/shared/loading-state";

export default function PaymentsLoading() {
  return <LoadingState cards={4} rows={8} />;
}
