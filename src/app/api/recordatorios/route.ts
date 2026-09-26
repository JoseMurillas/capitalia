import { NextResponse } from "next/server";

import { ServiceError } from "@/server/errors";
import { runReminders } from "@/server/services/reminders";
import { verifyCronSecret, verifyInboxToken } from "@/server/services/settings";

/**
 * Fifty sequential SMTP sends take longer than the default budget, and a run cut
 * off halfway can resend what it had already delivered.
 */
export const maxDuration = 60;

/**
 * Two ways in: the secret Vercel Cron sends automatically, and the automation
 * token already used by the bank inbox, so the run can also be fired by hand
 * with curl.
 */
async function authorize(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!provided) return false;

  if (verifyCronSecret(provided)) return true;
  return verifyInboxToken(provided);
}

/**
 * The daily run: generate today's reminders and send them. A GET because Vercel
 * Cron only issues GETs; calling it twice on the same day creates nothing new
 * (unique key) and sends nothing twice (already SENT).
 */
export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await runReminders();
    return NextResponse.json(result);
  } catch (error) {
    // A misconfigured environment is the likely cause, and whoever reads the
    // cron log needs to know which one — not an anonymous 500.
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
