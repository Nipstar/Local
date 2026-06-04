/**
 * Structured-data validation (spec Phase 6 — CI gate). Fetches key pages from a
 * running server and asserts the expected JSON-LD is present and well-formed:
 *   - business page → LocalBusiness (name + url) + BreadcrumbList
 *   - town page     → BreadcrumbList
 *   - sitemap.xml / robots.txt resolve
 *
 *   BASE_URL=http://localhost:3000 pnpm tsx scripts/validate-structured-data.ts
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

function extractJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      throw new Error(`Invalid JSON-LD block: ${m[1].slice(0, 80)}…`);
    }
  }
  return out;
}

const failures: string[] = [];
function check(cond: boolean, msg: string) {
  if (!cond) failures.push(msg);
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
}

async function get(path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.text() };
}

async function main() {
  const businessSlug = process.env.SD_BUSINESS_SLUG ?? "the-watercress-line-cafe";
  const townSlug = process.env.SD_TOWN_SLUG ?? "winchester";

  // Business page
  const biz = await get(`/business/${businessSlug}`);
  check(biz.status === 200, `business page 200 (${biz.status})`);
  const bizLd = extractJsonLd(biz.body);
  const local = bizLd.find((b) => b["@type"] === "LocalBusiness");
  check(Boolean(local), "business page has LocalBusiness JSON-LD");
  check(Boolean(local?.name), "LocalBusiness has name");
  check(Boolean(local?.url), "LocalBusiness has url");
  check(
    bizLd.some((b) => b["@type"] === "BreadcrumbList"),
    "business page has BreadcrumbList JSON-LD",
  );

  // Town page
  const town = await get(`/${townSlug}`);
  check(town.status === 200, `town page 200 (${town.status})`);
  check(
    extractJsonLd(town.body).some((b) => b["@type"] === "BreadcrumbList"),
    "town page has BreadcrumbList JSON-LD",
  );

  // Sitemap + robots
  const sm = await get("/sitemap.xml");
  check(sm.status === 200 && sm.body.includes("<urlset"), "sitemap.xml resolves");
  const rb = await get("/robots.txt");
  check(rb.status === 200 && rb.body.includes("Sitemap:"), "robots.txt resolves");

  if (failures.length) {
    console.error(`\n✗ ${failures.length} structured-data check(s) failed`);
    process.exit(1);
  }
  console.log("\n✓ all structured-data checks passed");
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ validator error:", e);
  process.exit(1);
});
