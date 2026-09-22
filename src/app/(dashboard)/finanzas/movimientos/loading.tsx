import { LoadingState } from "@/components/shared/loading-state";

export default function TransactionsLoading() {
  return <LoadingState cards={4} rows={8} />;
}
