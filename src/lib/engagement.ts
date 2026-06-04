/** Enquiries + view stats — premium owner analytics (spec Phase 5). */
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { enquiries, listingStats } from "@/db/schema";
import { logActivity } from "@/lib/activity";

export async function createEnquiry(
  businessId: string,
  input: { name?: string; email?: string; phone?: string; message?: string },
): Promise<void> {
  await db.insert(enquiries).values({
    businessId,
    name: input.name?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    message: input.message?.trim() || null,
  });
  await logActivity(businessId, "enquiry", { email: input.email });
}

export async function listEnquiries(businessId: string, limit = 50) {
  return db
    .select()
    .from(enquiries)
    .where(eq(enquiries.businessId, businessId))
    .orderBy(desc(enquiries.createdAt))
    .limit(limit);
}

/** Increment the view counter (called from a client beacon). */
export async function recordView(businessId: string): Promise<void> {
  await db
    .insert(listingStats)
    .values({ businessId, views: 1 })
    .onConflictDoUpdate({
      target: listingStats.businessId,
      set: { views: sql`${listingStats.views} + 1`, updatedAt: new Date() },
    });
}

export async function getEngagement(businessId: string) {
  const [stats] = await db
    .select({ views: listingStats.views })
    .from(listingStats)
    .where(eq(listingStats.businessId, businessId))
    .limit(1);
  const [enq] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(enquiries)
    .where(eq(enquiries.businessId, businessId));
  return { views: stats?.views ?? 0, enquiries: enq?.count ?? 0 };
}
