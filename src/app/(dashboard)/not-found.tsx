import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="No encontramos lo que buscas"
      description="El registro no existe o fue eliminado."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Ir al dashboard</Link>
        </Button>
      }
      className="min-h-64"
    />
  );
}
