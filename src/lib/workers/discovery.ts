/**
 * Discovery worker (spec Phase 2). Places Text Search (category × town) →
 * upsert `businesses` on place_id (the only Google value we persist) → enqueue
 * an async enrich job. Never blocks on enrichment.
 *
 * Shared by the API route (/api/workers/discovery) and the CLI (scripts/discover.ts).
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, categories, crawlJobs, locations } from "@/db/schema";
import { textSearch } from "@/lib/integrations/places";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export type DiscoveryOptions = {
  categorySlugs?: string[];
  townSlugs?: string[];
  /** Cap the number of category×town pairs processed in one run. */
  limitPairs?: number;
};

export type DiscoverySummary = {
  pairs: number;
  found: number;
  inserted: number;
  updated: number;
  enqueued: number;
};

export async function runDiscovery(
  opts: DiscoveryOptions = {},
): Promise<DiscoverySummary> {
  // Top-level categories only (the searchable trades), and towns.
  const cats = await db
    .select()
    .from(categories)
    .where(
      opts.categorySlugs?.length
        ? inArray(categories.slug, opts.categorySlugs)
        : isNull(categories.parentId),
    );
  const towns = await db
    .select()
    .from(locations)
    .where(opts.townSlugs?.length ? inArray(locations.slug, opts.townSlugs) : sql`true`);

  const summary: DiscoverySummary = {
    pairs: 0,
    found: 0,
    inserted: 0,
    updated: 0,
    enqueued: 0,
  };

  for (const town of towns) {
    for (const cat of cats) {
      if (opts.limitPairs && summary.pairs >= opts.limitPairs) return summary;
      summary.pairs++;

      const results = await textSearch(cat.name, town.name);
      summary.found += results.length;

      for (const r of results) {
        const { id, isNew } = await upsertProspect(r, cat.id, town.id);
        if (isNew) summary.inserted++;
        else summary.updated++;
        if (await enqueueEnrich(id)) summary.enqueued++;
      }
    }
  }
  return summary;
}

async function upsertProspect(
  r: { placeId: string; name: string; lat: number | null; lng: number | null },
  categoryId: string,
  locationId: string,
): Promise<{ id: string; isNew: boolean }> {
  const existing = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.placeId, r.placeId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(businesses)
      .set({
        name: r.name,
        categoryId,
        locationId,
        lat: r.lat,
        lng: r.lng,
        latCachedAt: new Date(), // 30-day compliance clock
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, existing[0].id));
    return { id: existing[0].id, isNew: false };
  }

  const slug = await uniqueSlug(slugify(r.name) || "business");
  const [row] = await db
    .insert(businesses)
    .values({
      placeId: r.placeId,
      slug,
      name: r.name,
      status: "prospect",
      categoryId,
      locationId,
      lat: r.lat,
      lng: r.lng,
      latCachedAt: new Date(),
    })
    .returning({ id: businesses.id });
  return { id: row.id, isNew: true };
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 1;
  // Slug collisions across distinct place_ids get a numeric suffix.
  while (
    (await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, slug)).limit(1)).length > 0
  ) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

/** Queue an enrich job unless one is already pending for this business. */
async function enqueueEnrich(businessId: string): Promise<boolean> {
  const pending = await db
    .select({ id: crawlJobs.id })
    .from(crawlJobs)
    .where(
      and(
        eq(crawlJobs.businessId, businessId),
        eq(crawlJobs.type, "enrich"),
        inArray(crawlJobs.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  if (pending[0]) return false;
  await db.insert(crawlJobs).values({ businessId, type: "enrich", status: "queued" });
  return true;
}
