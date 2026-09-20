import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { inboxPayloadSchema } from "@/lib/validations/inbox";
import { receiveInboxMessages } from "@/server/services/inbox";

/**
 * Receives bank notifications forwarded by an automation (Gmail Apps Script,
 * iOS Shortcut…). Not a user session: the caller proves itself with the
 * INBOX_TOKEN secret in the Authorization header.
 */
function authorized(request: Request): boolean {
  const expected = process.env.INBOX_TOKEN;
  if (!expected || expected.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo debe ser JSON" }, { status: 400 });
  }

  const parsed = inboxPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: z.flattenError(parsed.error) }, { status: 400 });
  }

  const result = await receiveInboxMessages(parsed.data);
  return NextResponse.json(result);
}
