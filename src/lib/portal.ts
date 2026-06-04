/**
 * Portal ownership (spec Phase 4). A user manages a business via a verified
 * claim (claims.userId + verifiedAt). NOTE: claiming here trusts the signed-in
 * user; stronger ownership proof (email-domain / GBP) is a future hardening.
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, claims, listingContent, subscriptions } from "@/db/schema";
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

/** Claim a business for a signed-in user (self-serve "Is this your business?"). */
export async function claimBusinessForUser(
  userId: string,
  businessIdOrSlug: string,
): Promise<{ ok: boolean; businessId?: string; error?: string }> {
  const [biz] =
    (await db
      .select()
      .from(businesses)
      .where(
        businessIdOrSlug.includes("-")
          ? eq(businesses.slug, businessIdOrSlug)
          : eq(businesses.id, businessIdOrSlug),
      )
      .limit(1)) ?? [];
  // Fall back to id lookup if slug missed.
  const business =
    biz ??
    (await db.select().from(businesses).where(eq(businesses.id, businessIdOrSlug)).limit(1))[0];
  if (!business) return { ok: false, error: "Business not found." };

  const existing = await db
    .select()
    .from(claims)
    .where(and(eq(claims.businessId, business.id), eq(claims.userId, userId)))
    .limit(1);

  if (existing[0]) {
    if (!existing[0].verifiedAt) {
      await db.update(claims).set({ verifiedAt: new Date() }).where(eq(claims.id, existing[0].id));
    }
  } else {
    await db.insert(claims).values({ businessId: business.id, userId, verifiedAt: new Date() });
  }

  // Promote to claimed (never demote premium/claimed).
  if (!["claimed", "premium"].includes(business.status)) {
    await db
      .update(businesses)
      .set({ status: "claimed", updatedAt: new Date() })
      .where(eq(businesses.id, business.id));
  }
  await logActivity(business.id, "claimed_in_portal", { userId });
  return { ok: true, businessId: business.id };
}
