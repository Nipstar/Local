/**
 * Owner review import + aggregate (spec Phase 5). Premium-gated. Reviews are
 * stored with author attribution and only ever come from the owner's connected
 * Google account (never bulk-scraped).
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, listingContent, reviews } from "@/db/schema";
import { fetchOwnerReviews } from "@/lib/integrations/gbp";
import { logActivity } from "@/lib/activity";

export async function importReviews(
  businessId: string,
  accessToken?: string,
): Promise<{ ok: boolean; imported?: number; error?: string }> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return { ok: false, error: "Business not found." };
  if (biz.status !== "premium") return { ok: false, error: "Review import is a Premium feature." };

  const fetched = await fetchOwnerReviews({
    placeId: biz.placeId,
    businessName: biz.name,
    accessToken,
  });

  // Replace prior GBP reviews for this business (idempotent re-import).
  await db.delete(reviews).where(and(eq(reviews.businessId, businessId), eq(reviews.source, "gbp")));
  if (fetched.length) {
    await db.insert(reviews).values(
      fetched.map((r) => ({
        businessId,
        source: "gbp",
        authorName: r.authorName,
        authorUrl: r.authorUrl,
        rating: r.rating,
        body: r.body,
        postedAt: r.postedAt,
      })),
    );
  }

  await recomputeAggregate(businessId);
  await logActivity(businessId, "reviews_imported", { count: fetched.length });
  return { ok: true, imported: fetched.length };
}

/** Roll review rows up into listing_content.rating / review_count. */
export async function recomputeAggregate(businessId: string): Promise<void> {
  const [agg] = await db
    .select({
      avg: sql<number>`coalesce(avg(${reviews.rating}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(eq(reviews.businessId, businessId));

  const rating = agg.count > 0 ? Math.round(Number(agg.avg) * 10) / 10 : null;
  await db
    .update(listingContent)
    .set({ rating, reviewCount: agg.count, updatedAt: new Date() })
    .where(eq(listingContent.businessId, businessId));
}

export async function getReviews(businessId: string, limit = 20) {
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.businessId, businessId))
    .orderBy(desc(reviews.postedAt))
    .limit(limit);
}
