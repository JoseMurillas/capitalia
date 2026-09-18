"use client";

import { es } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUrlParams } from "@/hooks/use-url-params";
import {
  endOfMonthIso,
  formatDate,
  type IsoDate,
  isIsoDate,
  startOfMonthIso,
  subMonthsIso,
  todayIso,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

type Preset = { label: string; range: () => { from: IsoDate; to: IsoDate } };

const PRESETS: Preset[] = [
  {
    label: "Este mes",
    range: () => ({ from: startOfMonthIso(todayIso()), to: endOfMonthIso(todayIso()) }),
  },
  {
    label: "Mes anterior",
    range: () => {
      const previous = subMonthsIso(todayIso(), 1);
      return { from: startOfMonthIso(previous), to: endOfMonthIso(previous) };
    },
  },
  {
    label: "Últimos 3 meses",
    range: () => ({ from: startOfMonthIso(subMonthsIso(todayIso(), 2)), to: todayIso() }),
  },
  {
    label: "Este año",
    range: () => ({ from: `${todayIso().slice(0, 4)}-01-01`, to: todayIso() }),
  },
];

function toLocalDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type DateRangePickerProps = {
  fromParam?: string;
  toParam?: string;
  /** Show a clear button that removes both parameters. */
  clearable?: boolean;
  /** Range shown and used when the URL carries none (e.g. reports default to the current month). */
  fallback?: { from: IsoDate; to: IsoDate };
  className?: string;
};

/** Date range filter bound to `from`/`to` URL parameters (yyyy-MM-dd). */
export function DateRangePicker({
  fromParam = "from",
  toParam = "to",
  clearable = true,
  fallback,
  className,
}: DateRangePickerProps) {
  const { searchParams, setParams } = useUrlParams();
  const [open, setOpen] = useState(false);

  const fromValue = searchParams.get(fromParam);
  const toValue = searchParams.get(toParam);
  const hasUrlRange = Boolean(fromValue || toValue);
  const from = fromValue && isIsoDate(fromValue) ? fromValue : hasUrlRange ? null : (fallback?.from ?? null);
  const to = toValue && isIsoDate(toValue) ? toValue : hasUrlRange ? null : (fallback?.to ?? null);

  const selected: DateRange | undefined = from
    ? { from: toLocalDate(from), to: to ? toLocalDate(to) : undefined }
    : undefined;

  const apply = (range: { from: IsoDate; to: IsoDate }) => {
    setParams({ [fromParam]: range.from, [toParam]: range.to }, { resetPage: true });
    setOpen(false);
  };

  const label =
    from && to ? `${formatDate(from)} – ${formatDate(to)}` : from ? formatDate(from) : "Todas las fechas";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start font-normal">
            <CalendarIcon aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-row flex-wrap gap-1 border-b p-2 sm:flex-col sm:border-r sm:border-b-0">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => apply(preset.range())}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Calendar
              mode="range"
              locale={es}
              numberOfMonths={1}
              defaultMonth={selected?.from ?? toLocalDate(todayIso())}
              selected={selected}
              onSelect={(range) => {
                if (range?.from && range.to) {
                  apply({ from: toIso(range.from), to: toIso(range.to) });
                } else if (range?.from) {
                  setParams({ [fromParam]: toIso(range.from), [toParam]: null }, { resetPage: true });
                }
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      {clearable && hasUrlRange ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Quitar filtro de fechas"
          onClick={() => setParams({ [fromParam]: null, [toParam]: null }, { resetPage: true })}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
