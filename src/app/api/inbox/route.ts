import { NextResponse } from "next/server";
import { z } from "zod";

import { inboxPayloadSchema } from "@/lib/validations/inbox";
import { receiveInboxMessages } from "@/server/services/inbox";
import { verifyInboxToken } from "@/server/services/settings";

/**
 * Receives bank notifications forwarded by an automation (Gmail Apps Script,
 * iOS Shortcut…). Not a user session: the caller proves itself with the inbox
 * token (generated in Configuración) in the Authorization header.
 */
export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!(await verifyInboxToken(provided))) {
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
