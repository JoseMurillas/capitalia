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
