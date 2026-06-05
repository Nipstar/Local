/**
 * Portal ownership (spec Phase 4 + claim hardening). A user manages a business
 * via a VERIFIED claim (claims.userId + verifiedAt).
 *
 * Self-serve claims are auto-verified only when we have a signal the claimant
 * belongs to the business — currently an email-domain match against the
 * business website. Otherwise the claim is left PENDING (verifiedAt null) for
 * an admin to approve, so strangers can't silently take over listings.
 */
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, claims, listingContent, subscriptions, users } from "@/db/schema";
import { logActivity } from "@/lib/activity";

export async function getManagedBusinesses(userId: string) {
  return db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      status: businesses.status,
      displayName: listingContent.displayName,
      tier: subscriptions.tier,
    })
    .from(claims)
    .innerJoin(businesses, eq(businesses.id, claims.businessId))
    .leftJoin(listingContent, eq(listingContent.businessId, businesses.id))
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .where(and(eq(claims.userId, userId), isNotNull(claims.verifiedAt)))
    .orderBy(businesses.name);
}

export async function userOwnsBusiness(userId: string, businessId: string): Promise<boolean> {
  const rows = await db
    .select({ id: claims.id })
    .from(claims)
    .where(
      and(
        eq(claims.userId, userId),
        eq(claims.businessId, businessId),
        isNotNull(claims.verifiedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** hostname without leading www, lowercased. */
function host(url?: string | null): string | null {
  if (!url) return null;
  try {
    const h = new URL(url.includes("://") ? url : `https://${url}`).hostname.toLowerCase();
    return h.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Claim a business for a signed-in user. Auto-verifies when the user's email
 * domain matches the business website domain; otherwise leaves it pending.
 */
export async function claimBusinessForUser(
  userId: string,
  businessIdOrSlug: string,
): Promise<{ ok: boolean; businessId?: string; pending?: boolean; error?: string }> {
  const looksLikeSlug = businessIdOrSlug.includes("-") && !/^[0-9a-f-]{36}$/i.test(businessIdOrSlug);
  const business =
    (
      await db
        .select()
        .from(businesses)
        .where(looksLikeSlug ? eq(businesses.slug, businessIdOrSlug) : eq(businesses.id, businessIdOrSlug))
        .limit(1)
    )[0] ??
    (await db.select().from(businesses).where(eq(businesses.slug, businessIdOrSlug)).limit(1))[0];
  if (!business) return { ok: false, error: "Business not found." };

  // Decide whether we can auto-verify (email domain ↔ website domain).
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [content] = await db
    .select({ website: listingContent.website })
    .from(listingContent)
    .where(eq(listingContent.businessId, business.id))
    .limit(1);
  const emailDomain = user?.email?.split("@")[1]?.toLowerCase() ?? null;
  const siteDomain = host(content?.website);
  const autoVerify = Boolean(emailDomain && siteDomain && emailDomain === siteDomain);

  const existing = await db
    .select()
    .from(claims)
    .where(and(eq(claims.businessId, business.id), eq(claims.userId, userId)))
    .limit(1);

  if (existing[0]) {
    if (autoVerify && !existing[0].verifiedAt) {
      await db.update(claims).set({ verifiedAt: new Date() }).where(eq(claims.id, existing[0].id));
    }
  } else {
    await db.insert(claims).values({
      businessId: business.id,
      userId,
      verifiedAt: autoVerify ? new Date() : null,
    });
  }

  if (autoVerify) {
    if (!["claimed", "premium"].includes(business.status)) {
      await db
        .update(businesses)
        .set({ status: "claimed", updatedAt: new Date() })
        .where(eq(businesses.id, business.id));
    }
    await logActivity(business.id, "claimed_in_portal", { userId, autoVerified: true });
    return { ok: true, businessId: business.id, pending: false };
  }

  await logActivity(business.id, "claim_pending", { userId, reason: "no domain match" });
  return { ok: true, businessId: business.id, pending: true };
}

// ─── Admin claim review ──────────────────────────────────────────────────────
export async function listPendingClaims(businessId: string) {
  return db
    .select({
      id: claims.id,
      userId: claims.userId,
      email: users.email,
      createdAt: claims.createdAt,
    })
    .from(claims)
    .leftJoin(users, eq(users.id, claims.userId))
    .where(
      and(
        eq(claims.businessId, businessId),
        isNull(claims.verifiedAt),
        isNotNull(claims.userId),
      ),
    )
    .orderBy(desc(claims.createdAt));
}

/** Admin approves a pending claim → verify it and mark the business claimed. */
export async function approveClaim(claimId: string): Promise<void> {
  const [claim] = await db.select().from(claims).where(eq(claims.id, claimId)).limit(1);
  if (!claim?.businessId) return;
  await db.update(claims).set({ verifiedAt: new Date() }).where(eq(claims.id, claimId));
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, claim.businessId)).limit(1);
  if (biz && !["claimed", "premium"].includes(biz.status)) {
    await db
      .update(businesses)
      .set({ status: "claimed", updatedAt: new Date() })
      .where(eq(businesses.id, biz.id));
  }
  await logActivity(claim.businessId, "claim_approved", { claimId });
}
