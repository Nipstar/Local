/** Append-only activity timeline for a business (admin CRM, spec Phase 3). */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog } from "@/db/schema";

export async function logActivity(
  businessId: string,
  type: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  await db.insert(activityLog).values({ businessId, type, payload: payload ?? {} });
}

export async function getActivity(businessId: string, limit = 50) {
  return db
    .select()
    .from(activityLog)
    .where(eq(activityLog.businessId, businessId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
}
