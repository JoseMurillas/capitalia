"use client";

import { CircleAlert } from "lucide-react";
import { useEffect } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={CircleAlert}
      title="Algo salió mal"
      description="No pudimos cargar esta sección. Revisa la conexión con la base de datos e inténtalo de nuevo."
      action={
        <Button size="sm" onClick={reset}>
          Reintentar
        </Button>
      }
      className="min-h-64"
    />
  );
}
