import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";

/**
 * Business dates (loan start, due dates, payment dates, transaction dates) are
 * date-only values. They travel through the app as `yyyy-MM-dd` strings and are
 * stored as `@db.Date`, which Prisma exposes as a `Date` at UTC midnight.
 *
 * Rules to avoid off-by-one-day bugs:
 * - DB <-> ISO conversions use UTC (`fromIsoDate` / `toIsoDate`).
 * - Arithmetic and formatting parse the ISO string as a *local* date.
 * - "Today" is resolved in Colombia's time zone, not the server's.
 */
export type IsoDate = string;

export const APP_TIME_ZONE = "America/Bogota";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  return !Number.isNaN(parseISO(value).getTime());
}

/** Today's date in Colombia as `yyyy-MM-dd`. */
export function todayIso(): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(
    new Date(),
  );
}

/** Converts a DB `Date` (UTC midnight) to `yyyy-MM-dd`. */
export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Converts `yyyy-MM-dd` to the UTC-midnight `Date` Prisma expects for `@db.Date`. */
export function fromIsoDate(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function toLocal(iso: IsoDate): Date {
  return parseISO(iso);
}

function fromLocal(date: Date): IsoDate {
  return format(date, "yyyy-MM-dd");
}

export function addDaysIso(iso: IsoDate, days: number): IsoDate {
  return fromLocal(addDays(toLocal(iso), days));
}

export function addMonthsIso(iso: IsoDate, months: number): IsoDate {
  return fromLocal(addMonths(toLocal(iso), months));
}

export function subMonthsIso(iso: IsoDate, months: number): IsoDate {
  return fromLocal(subMonths(toLocal(iso), months));
}

export function startOfMonthIso(iso: IsoDate): IsoDate {
  return fromLocal(startOfMonth(toLocal(iso)));
}

export function endOfMonthIso(iso: IsoDate): IsoDate {
  return fromLocal(endOfMonth(toLocal(iso)));
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetweenIso(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarDays(toLocal(to), toLocal(from));
}

/** `yyyy-MM` key used to group monthly series. */
export function monthKey(iso: IsoDate): string {
  return iso.slice(0, 7);
}

/** `18 sept 2026` */
export function formatDate(iso: IsoDate): string {
  return format(toLocal(iso), "d MMM yyyy", { locale: es });
}

/** `18 de septiembre de 2026` */
export function formatDateLong(iso: IsoDate): string {
  return format(toLocal(iso), "d 'de' MMMM 'de' yyyy", { locale: es });
}

/** `sept 2026` — used as chart axis labels. */
export function formatMonth(key: string): string {
  return format(parseISO(`${key}-01`), "MMM yyyy", { locale: es });
}

/** `sept` — month only, for tight chart axes where the tooltip carries the year. */
export function formatMonthShort(key: string): string {
  return format(parseISO(`${key}-01`), "MMM", { locale: es });
}

/** `18 sept 2026, 14:05` for timestamps such as `createdAt`. */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
