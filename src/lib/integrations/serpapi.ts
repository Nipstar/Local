/**
 * SerpAPI — Google Local engine. Returns the 3-pack position for a business
 * against target keywords at a town centroid (spec §2). Position 0 = not found
 * in the local results; 1–3 = in the pack; 4+ = below the fold.
 *
 * Mock mode: when SERPAPI_KEY is absent, a deterministic position is derived
 * from the business name so scoring (ranks 4–10 → geo) is exercisable in dev.
 */
import { env, features } from "@/lib/config";

const BASE = "https://serpapi.com/search.json";

export type PackRank = Record<string, number>;

export async function packRankForKeywords(
  businessName: string,
  keywords: string[],
  centroid: { lat: number; lng: number },
): Promise<PackRank> {
  const out: PackRank = {};
  for (const kw of keywords) {
    out[kw] = features.liveSerpapi
      ? await liveRank(businessName, kw, centroid)
      : mockRank(businessName, kw);
  }
  return out;
}

async function liveRank(
  businessName: string,
  keyword: string,
  centroid: { lat: number; lng: number },
): Promise<number> {
  const params = new URLSearchParams({
    engine: "google_local",
    q: keyword,
    ll: `@${centroid.lat},${centroid.lng},14z`,
    api_key: env.serpapiKey!,
  });
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { local_results?: { title?: string }[] };
  const results = data.local_results ?? [];
  const idx = results.findIndex(
    (r) => (r.title ?? "").toLowerCase().includes(businessName.toLowerCase()),
  );
  return idx === -1 ? 0 : idx + 1;
}

/** Stable pseudo-rank in 0..10 from the name+keyword hash. */
function mockRank(businessName: string, keyword: string): number {
  let h = 0;
  for (const ch of businessName + keyword) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h % 11; // 0 = unranked, 1..10 = position
}
