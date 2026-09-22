"use client";

import { BellRing } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { updateReminderDaysAction } from "@/server/actions/settings";

const SHORTCUTS = [1, 3, 5, 7];

export function ReminderSettingsCard({ defaultDays }: { defaultDays: number }) {
  const [saved, setSaved] = useState(defaultDays);
  const [draft, setDraft] = useState(String(defaultDays));
  const [isPending, startTransition] = useTransition();

  const save = (days: number) =>
    startTransition(async () => {
      const result = await updateReminderDaysAction({ days });
      if (!result.success) {
        toast.error(result.fieldErrors?.days?.[0] ?? result.error);
        return;
      }
      setSaved(days);
      setDraft(String(days));
      toast.success(`Los nuevos compromisos avisarán ${days === 0 ? "el mismo día" : `${days} días antes`}`);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
          Alertas de compromisos
        </CardTitle>
        <CardDescription>
          Con cuántos días de anticipación avisar de un gasto recurrente o del pago de una tarjeta. Los registros
          nuevos toman este valor; cada uno puede cambiarlo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {SHORTCUTS.map((days) => (
            <Button
              key={days}
              type="button"
              size="sm"
              variant={saved === days ? "default" : "outline"}
              disabled={isPending}
              onClick={() => save(days)}
            >
              {days} {days === 1 ? "día" : "días"}
            </Button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save(Number(draft));
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminder-days">Otro valor (0 a 60 días)</Label>
            <Input
              id="reminder-days"
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              className="w-32"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={isPending || draft === String(saved)}>
            {isPending ? <Spinner /> : null}
            Guardar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
