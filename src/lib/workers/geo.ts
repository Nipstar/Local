/**
 * Lat/lng refresh (spec §0 + Phase 6). Google permits caching lat/lng for at
 * most 30 days; this worker refreshes coordinates whose cache has expired (or
 * was never set), keeping us compliant. n8n runs it daily.
 *
 * Shared by /api/workers/refresh-geo and scripts/refresh-geo.ts.
 */
import { lt, or, isNull, sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { placeLocation } from "@/lib/integrations/places";

export type GeoRefreshSummary = { stale: number; refreshed: number; missing: number };

export async function refreshStaleGeo(
  opts: { olderThanDays?: number; limit?: number } = {},
): Promise<GeoRefreshSummary> {
  const days = opts.olderThanDays ?? 30;
  const cutoff = new Date(Date.now() - days * 86_400_000);

  const stale = await db
    .select({ id: businesses.id, placeId: businesses.placeId })
    .from(businesses)
    .where(or(isNull(businesses.latCachedAt), lt(businesses.latCachedAt, cutoff)))
    .limit(opts.limit ?? 200);

  const summary: GeoRefreshSummary = { stale: stale.length, refreshed: 0, missing: 0 };

  for (const b of stale) {
    const loc = await placeLocation(b.placeId);
    if (!loc) {
      summary.missing++;
      // Still bump the clock so we don't hammer a dead place_id every run.
      await db
        .update(businesses)
        .set({ latCachedAt: new Date() })
        .where(eq(businesses.id, b.id));
      continue;
    }
    await db
      .update(businesses)
      .set({ lat: loc.lat, lng: loc.lng, latCachedAt: new Date(), updatedAt: new Date() })
      .where(eq(businesses.id, b.id));
    summary.refreshed++;
  }
  return summary;
}

/** How many rows are currently past the cache window (for monitoring). */
export async function staleGeoCount(olderThanDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businesses)
    .where(or(isNull(businesses.latCachedAt), lt(businesses.latCachedAt, cutoff)));
  return row?.n ?? 0;
}
