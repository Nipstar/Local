import { NextResponse } from "next/server";
import { recordEvent, optOut, type BrevoEvent } from "@/lib/outreach";
import { db } from "@/db";
import { outreachContacts, outreachMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Brevo event webhook. Maps delivery/open/click/reply/unsubscribe events back
 * onto outreach_messages (and opts the contact out on unsubscribe).
 *
 * Brevo posts one event per request: { event, "message-id", tags? }. Correlate
 * by message-id; tags carry contact:<id> for unsubscribe handling.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { event?: string; "message-id"?: string; tags?: string[] }
    | null;
  if (!body?.event) return NextResponse.json({ error: "bad payload" }, { status: 400 });

  const event = body.event as BrevoEvent;
  const messageId = body["message-id"];

  if (event === "unsubscribed") {
    const contactId =
      body.tags?.find((t) => t.startsWith("contact:"))?.split(":")[1] ??
      (await contactIdForMessage(messageId));
    if (contactId) await optOut(contactId);
    return NextResponse.json({ ok: true, handled: "unsubscribe" });
  }

  if (messageId) await recordEvent(messageId, event);
  return NextResponse.json({ ok: true });
}

async function contactIdForMessage(messageId?: string): Promise<string | null> {
  if (!messageId) return null;
  const [m] = await db
    .select({ contactId: outreachMessages.contactId })
    .from(outreachMessages)
    .where(eq(outreachMessages.brevoId, messageId))
    .limit(1);
  if (!m?.contactId) return null;
  const [c] = await db
    .select({ id: outreachContacts.id })
    .from(outreachContacts)
    .where(eq(outreachContacts.id, m.contactId))
    .limit(1);
  return c?.id ?? null;
}
