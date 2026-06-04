/**
 * Outreach sequences (spec Phase 3): confirm → reminder → soft pitch, sent via
 * Brevo, with reply/open/click events written back to outreach_messages.
 *
 * PECR compliance: corporate subscribers (ltd | llp) may be emailed under the
 * corporate-subscriber basis with clear identity + opt-out. Sole traders /
 * partnerships are treated as individuals — only emailed with a recorded
 * consent basis. opted_out is always honoured.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  campaigns,
  outreachContacts,
  outreachMessages,
} from "@/db/schema";
import { SITE } from "@/lib/config";
import { sendTransactional } from "@/lib/integrations/brevo";
import { createClaimToken } from "@/lib/claims";
import { logActivity } from "@/lib/activity";

export type EntityType = "ltd" | "llp" | "sole_trader" | "partnership";

/** PECR gate: corporates are emailable; individuals need a consent basis. */
export function isEmailable(c: {
  entityType: string | null;
  consentBasis: string | null;
  optedOut: boolean | null;
}): boolean {
  if (c.optedOut) return false;
  if (c.entityType === "ltd" || c.entityType === "llp") return true;
  return Boolean(c.consentBasis); // sole_trader / partnership / unknown
}

export async function ensureContact(
  businessId: string,
  input: { email: string; entityType?: EntityType; consentBasis?: string },
): Promise<string> {
  const existing = await db
    .select()
    .from(outreachContacts)
    .where(eq(outreachContacts.businessId, businessId))
    .limit(1);
  if (existing[0]) {
    await db
      .update(outreachContacts)
      .set({
        email: input.email,
        entityType: input.entityType ?? existing[0].entityType,
        consentBasis: input.consentBasis ?? existing[0].consentBasis,
      })
      .where(eq(outreachContacts.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db
    .insert(outreachContacts)
    .values({
      businessId,
      email: input.email,
      entityType: input.entityType ?? "ltd",
      consentBasis: input.consentBasis ?? null,
      optedOut: false,
    })
    .returning({ id: outreachContacts.id });
  return row.id;
}

export async function getOrCreateCampaign(name: string): Promise<string> {
  const existing = await db.select().from(campaigns).where(eq(campaigns.name, name)).limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db
    .insert(campaigns)
    .values({ name, channel: "email", status: "active" })
    .returning({ id: campaigns.id });
  return row.id;
}

// ─── The sequence ────────────────────────────────────────────────────────────
type StepCtx = { businessName: string; confirmUrl: string; unsubscribeUrl: string };

const SEQUENCE: { step: number; subject: (c: StepCtx) => string; html: (c: StepCtx) => string }[] = [
  {
    step: 1,
    subject: (c) => `${c.businessName} — confirm your free ${SITE.name} listing`,
    html: (c) => wrap(
      c,
      `<p>Hello,</p>
       <p>${c.businessName} is listed on <strong>${SITE.name}</strong>, the ${SITE.county}
       directory. We'd love to show your own details rather than what's scraped from Google.</p>
       <p><a href="${c.confirmUrl}">Confirm your details</a> — it takes a minute and your
       listing goes live as yours.</p>`,
    ),
  },
  {
    step: 2,
    subject: (c) => `Reminder: confirm ${c.businessName} on ${SITE.name}`,
    html: (c) => wrap(
      c,
      `<p>Just a nudge — ${c.businessName} still shows placeholder details on ${SITE.name}.</p>
       <p><a href="${c.confirmUrl}">Confirm your details</a> to take control of your listing.</p>`,
    ),
  },
  {
    step: 3,
    subject: (c) => `Stand out in ${SITE.county} — ${c.businessName}`,
    html: (c) => wrap(
      c,
      `<p>Once confirmed, you can go Premium: full-bleed photography, a gallery and the
       green Verified badge customers look for.</p>
       <p><a href="${c.confirmUrl}">Start by confirming your details</a>.</p>`,
    ),
  },
];

export const MAX_STEP = SEQUENCE.length;

function wrap(c: StepCtx, body: string): string {
  return `${body}
    <hr/>
    <p style="font-size:12px;color:#5A584F">
      ${SITE.name} · ${SITE.county}. You're receiving this as the business contact for
      ${c.businessName}. <a href="${c.unsubscribeUrl}">Unsubscribe</a>.
    </p>`;
}

export type OutreachSummary = { eligible: number; sent: number; skipped: number; step: Record<number, number> };

/** Send the next due step to each eligible contact in a campaign. */
export async function runCampaignStep(
  campaignId: string,
  opts: { limit?: number } = {},
): Promise<OutreachSummary> {
  const summary: OutreachSummary = { eligible: 0, sent: 0, skipped: 0, step: {} };

  // Prospects/contacted businesses with a contact, not yet confirmed.
  const rows = await db
    .select({
      businessId: businesses.id,
      businessName: businesses.name,
      status: businesses.status,
      contactId: outreachContacts.id,
      email: outreachContacts.email,
      entityType: outreachContacts.entityType,
      consentBasis: outreachContacts.consentBasis,
      optedOut: outreachContacts.optedOut,
    })
    .from(businesses)
    .innerJoin(outreachContacts, eq(outreachContacts.businessId, businesses.id))
    .where(inArray(businesses.status, ["prospect", "contacted"]))
    .limit(opts.limit ?? 100);

  for (const r of rows) {
    if (!r.email || !isEmailable(r)) {
      summary.skipped++;
      continue;
    }
    summary.eligible++;

    // Determine the next step from prior sends.
    const [last] = await db
      .select({ step: outreachMessages.step })
      .from(outreachMessages)
      .where(
        and(
          eq(outreachMessages.campaignId, campaignId),
          eq(outreachMessages.contactId, r.contactId),
        ),
      )
      .orderBy(desc(outreachMessages.step))
      .limit(1);

    const nextStep = (last?.step ?? 0) + 1;
    if (nextStep > MAX_STEP) {
      summary.skipped++;
      continue;
    }

    const template = SEQUENCE[nextStep - 1];
    const { url: confirmUrl } = await createClaimToken(r.businessId);
    const ctx: StepCtx = {
      businessName: r.businessName,
      confirmUrl,
      unsubscribeUrl: `${SITE.url}/unsubscribe/${r.contactId}`,
    };

    const result = await sendTransactional({
      to: { email: r.email },
      subject: template.subject(ctx),
      html: template.html(ctx),
      tags: [`campaign:${campaignId}`, `step:${nextStep}`, `contact:${r.contactId}`],
    });

    await db.insert(outreachMessages).values({
      campaignId,
      contactId: r.contactId,
      step: nextStep,
      sentAt: new Date(),
      brevoId: result.messageId,
    });

    if (r.status === "prospect") {
      await db
        .update(businesses)
        .set({ status: "contacted", updatedAt: new Date() })
        .where(eq(businesses.id, r.businessId));
    }
    await logActivity(r.businessId, "outreach_sent", { step: nextStep, messageId: result.messageId });

    summary.sent++;
    summary.step[nextStep] = (summary.step[nextStep] ?? 0) + 1;
  }
  return summary;
}

// ─── Event ingestion (Brevo webhook) ─────────────────────────────────────────
export type BrevoEvent = "opened" | "click" | "delivered" | "unsubscribed" | "reply";

export async function recordEvent(messageId: string, event: BrevoEvent): Promise<boolean> {
  const set: Partial<typeof outreachMessages.$inferInsert> = {};
  if (event === "opened") set.openedAt = new Date();
  else if (event === "click") set.openedAt = new Date();
  else if (event === "reply") set.repliedAt = new Date();
  else return false;

  const updated = await db
    .update(outreachMessages)
    .set(set)
    .where(eq(outreachMessages.brevoId, messageId))
    .returning({ id: outreachMessages.id, contactId: outreachMessages.contactId });
  return updated.length > 0;
}

export async function optOut(contactId: string): Promise<boolean> {
  const updated = await db
    .update(outreachContacts)
    .set({ optedOut: true })
    .where(eq(outreachContacts.id, contactId))
    .returning({ id: outreachContacts.id, businessId: outreachContacts.businessId });
  if (updated[0]?.businessId) await logActivity(updated[0].businessId, "opted_out", {});
  return updated.length > 0;
}

/** Count of emailable contacts (for the admin dashboard). */
export async function outreachStats() {
  const [row] = await db
    .select({
      contacts: sql<number>`count(*)::int`,
      optedOut: sql<number>`count(*) filter (where ${outreachContacts.optedOut})::int`,
    })
    .from(outreachContacts);
  return row;
}
