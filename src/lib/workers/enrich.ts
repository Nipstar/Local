/**
 * Enrichment worker (spec Phase 2). Drains the `crawl_jobs` queue:
 *   place details (transient website) → crawl + tech fingerprint
 *   → SerpAPI local pack rank → score → write `enrichment`.
 *
 * §0 compliance: the website is fetched transiently from Places at enrich time
 * and never stored; only the derived signals (tech, rank, score) are persisted.
 *
 * Shared by the API route (/api/workers/queue/tick) and CLI (scripts/enrich.ts).
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  categories,
  crawlJobs,
  enrichment,
  locations,
} from "@/db/schema";
import { placeDetails } from "@/lib/integrations/places";
import { crawlSite } from "@/lib/integrations/crawl";
import { packRankForKeywords } from "@/lib/integrations/serpapi";
import { scoreLead } from "@/lib/scoring";

export type EnrichSummary = { processed: number; errored: number };

export async function runEnrichQueue(batch = 25): Promise<EnrichSummary> {
  const jobs = await claimJobs(batch);
  const summary: EnrichSummary = { processed: 0, errored: 0 };

  for (const job of jobs) {
    try {
      if (job.businessId) await enrichBusiness(job.businessId);
      await db
        .update(crawlJobs)
        .set({ status: "done", updatedAt: new Date() })
        .where(eq(crawlJobs.id, job.id));
      summary.processed++;
    } catch (err) {
      await db
        .update(crawlJobs)
        .set({
          status: "error",
          attempts: (job.attempts ?? 0) + 1,
          error: String(err),
          updatedAt: new Date(),
        })
        .where(eq(crawlJobs.id, job.id));
      summary.errored++;
    }
  }
  return summary;
}

/** Atomically flip a batch of queued jobs to running. */
async function claimJobs(batch: number) {
  const queued = await db
    .select()
    .from(crawlJobs)
    .where(and(eq(crawlJobs.type, "enrich"), eq(crawlJobs.status, "queued")))
    .limit(batch);
  if (queued.length === 0) return [];
  await db
    .update(crawlJobs)
    .set({ status: "running", updatedAt: new Date() })
    .where(inArray(crawlJobs.id, queued.map((j) => j.id)));
  return queued;
}

export async function enrichBusiness(businessId: string): Promise<void> {
  const [row] = await db
    .select({
      placeId: businesses.placeId,
      name: businesses.name,
      catName: categories.name,
      lat: locations.centroidLat,
      lng: locations.centroidLng,
    })
    .from(businesses)
    .leftJoin(categories, eq(categories.id, businesses.categoryId))
    .leftJoin(locations, eq(locations.id, businesses.locationId))
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!row) throw new Error(`business ${businessId} not found`);

  // Transient website from Places — used, never stored (§0).
  const details = await placeDetails(row.placeId);
  const website = details?.website ?? null;

  const crawl = await crawlSite(website);

  const centroid =
    row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : null;
  const keyword = (row.catName ?? "services").toLowerCase();
  const packRank = centroid
    ? await packRankForKeywords(row.name, [keyword], centroid)
    : null;

  const { leadType, score } = scoreLead({
    hasWebsite: crawl.hasWebsite,
    tech: crawl.tech,
    packRank,
  });

  await db
    .insert(enrichment)
    .values({
      businessId,
      hasWebsite: crawl.hasWebsite,
      tech: crawl.tech,
      packRank,
      leadType,
      score,
      checkedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: enrichment.businessId,
      set: {
        hasWebsite: crawl.hasWebsite,
        tech: crawl.tech,
        packRank,
        leadType,
        score,
        checkedAt: new Date(),
      },
    });
}
