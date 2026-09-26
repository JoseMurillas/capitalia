import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

export const INBOX_TOKEN_HASH_KEY = "inbox_token_hash";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a new inbox token, stores only its hash and returns the plain
 * token once so the user can paste it into their automation.
 */
export async function rotateInboxToken(): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await setSetting(INBOX_TOKEN_HASH_KEY, hashToken(token));
  return token;
}

export async function hasInboxToken(): Promise<boolean> {
  if (await getSetting(INBOX_TOKEN_HASH_KEY)) return true;
  return Boolean(process.env.INBOX_TOKEN && process.env.INBOX_TOKEN.length >= 16);
}

/** Accepts the app-managed token; INBOX_TOKEN from the environment keeps working as a fallback. */
export async function verifyInboxToken(provided: string): Promise<boolean> {
  if (!provided) return false;
  const providedHash = hashToken(provided);

  const storedHash = await getSetting(INBOX_TOKEN_HASH_KEY);
  if (storedHash && storedHash.length === providedHash.length) {
    if (timingSafeEqual(Buffer.from(storedHash), Buffer.from(providedHash))) return true;
  }

  const envToken = process.env.INBOX_TOKEN;
  if (envToken && envToken.length >= 16) {
    const envHash = hashToken(envToken);
    return timingSafeEqual(Buffer.from(envHash), Buffer.from(providedHash));
  }
  return false;
}

/**
 * The secret Vercel Cron sends with every scheduled call. Compared the same way
 * as the inbox token — hashed first, then byte by byte in constant time — so the
 * two entrances to the automation endpoints are equally hard to guess.
 */
export function verifyCronSecret(provided: string): boolean {
  const secret = process.env.CRON_SECRET;
  if (!provided || !secret) return false;
  return timingSafeEqual(Buffer.from(hashToken(secret)), Buffer.from(hashToken(provided)));
}

export const DEFAULT_REMINDER_DAYS_KEY = "default_reminder_days";
export const DEFAULT_REMINDER_DAYS = 3;

/** Reminder window new recurring expenses and cards start with. */
export async function getDefaultReminderDays(): Promise<number> {
  const raw = await getSetting(DEFAULT_REMINDER_DAYS_KEY);
  if (raw === null) return DEFAULT_REMINDER_DAYS;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 60 ? value : DEFAULT_REMINDER_DAYS;
}

export async function setDefaultReminderDays(days: number): Promise<void> {
  await setSetting(DEFAULT_REMINDER_DAYS_KEY, String(days));
}

export const REMINDERS_ENABLED_KEY = "reminders_enabled";
export const REMINDER_SIGNATURE_KEY = "reminder_signature";
export const REMINDER_CONTACT_KEY = "reminder_contact";

export type ReminderSettings = {
  /** When false nothing is generated and nothing is sent. */
  enabled: boolean;
  /** Name the emails are signed with. */
  signature: string;
  /** Phone or WhatsApp offered in the email; null hides that line. */
  contact: string | null;
};

/** Reminders stay off until the user turns them on; the signature defaults to the admin's name. */
export async function getReminderSettings(): Promise<ReminderSettings> {
  const [enabled, signature, contact] = await Promise.all([
    getSetting(REMINDERS_ENABLED_KEY),
    getSetting(REMINDER_SIGNATURE_KEY),
    getSetting(REMINDER_CONTACT_KEY),
  ]);
  if (signature) return { enabled: enabled === "true", signature, contact: contact || null };

  const admin = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { name: true } });
  return { enabled: enabled === "true", signature: admin?.name ?? "Capitalia", contact: contact || null };
}

export async function setReminderSettings(input: ReminderSettings): Promise<void> {
  await Promise.all([
    setSetting(REMINDERS_ENABLED_KEY, String(input.enabled)),
    setSetting(REMINDER_SIGNATURE_KEY, input.signature),
    setSetting(REMINDER_CONTACT_KEY, input.contact ?? ""),
  ]);
}
