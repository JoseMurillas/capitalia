import { type IsoDate, isIsoDate } from "@/lib/dates";

export type SearchParams = Record<string, string | string[] | undefined>;

export const DEFAULT_PAGE_SIZE = 20;

export function getString(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  const trimmed = single?.trim();
  return trimmed ? trimmed : undefined;
}

export function getPage(params: SearchParams): number {
  const raw = Number(getString(params, "page") ?? "1");
  return Number.isInteger(raw) && raw >= 1 ? raw : 1;
}

export function getIsoDate(params: SearchParams, key: string): IsoDate | undefined {
  const value = getString(params, key);
  return value && isIsoDate(value) ? value : undefined;
}

export function getEnum<const T extends readonly string[]>(
  params: SearchParams,
  key: string,
  allowed: T,
): T[number] | undefined {
  const value = getString(params, key);
  return value && (allowed as readonly string[]).includes(value) ? (value as T[number]) : undefined;
}

export function paginate(page: number, pageSize = DEFAULT_PAGE_SIZE) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pageCountFor(total: number, pageSize = DEFAULT_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
