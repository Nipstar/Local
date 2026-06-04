/**
 * Seed reference data: the six top-level categories (with child trades) from
 * the mockup, and Hampshire towns with approximate centroids. Idempotent —
 * upserts by slug, safe to re-run.
 *
 *   pnpm db:seed
 *
 * Pass --demo to also insert a handful of demo businesses + owned listing
 * content so the public pages render with real-looking rows in dev.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql as dsql } from "drizzle-orm";
import {
  categories,
  locations,
  businesses,
  listingContent,
  enrichment,
} from "../src/db/schema";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ─── Categories: [name, blurb, [children]] ──────────────────────────────────
const CATEGORIES: { name: string; blurb: string; children: string[] }[] = [
  {
    name: "Trades & home",
    blurb: "Plumbers · Electricians · Builders",
    children: ["Plumbers", "Electricians", "Builders", "Roofers", "Painters & decorators", "Landscapers"],
  },
  {
    name: "Eat & drink",
    blurb: "Pubs · Cafés · Restaurants",
    children: ["Pubs", "Cafés", "Restaurants", "Bakeries", "Farm shops"],
  },
  {
    name: "Shops & makers",
    blurb: "Butchers · Florists · Galleries",
    children: ["Butchers", "Florists", "Galleries", "Bookshops", "Delis"],
  },
  {
    name: "Health & beauty",
    blurb: "Salons · Clinics · Wellbeing",
    children: ["Salons", "Clinics", "Wellbeing", "Barbers", "Dentists"],
  },
  {
    name: "Professional",
    blurb: "Solicitors · Accountants · Estate agents",
    children: ["Solicitors", "Accountants", "Estate agents", "Architects", "Surveyors"],
  },
  {
    name: "Leisure & days out",
    blurb: "Farms · Vineyards · Walks",
    children: ["Farms", "Vineyards", "Walks", "Museums", "Gardens"],
  },
];

// ─── Hampshire towns with approximate centroids ─────────────────────────────
const TOWNS: { name: string; lat: number; lng: number }[] = [
  { name: "Winchester", lat: 51.0632, lng: -1.308 },
  { name: "Alresford", lat: 51.09, lng: -1.16 },
  { name: "Andover", lat: 51.2113, lng: -1.487 },
  { name: "Basingstoke", lat: 51.2665, lng: -1.0876 },
  { name: "Eastleigh", lat: 50.969, lng: -1.35 },
  { name: "Fareham", lat: 50.852, lng: -1.179 },
  { name: "Gosport", lat: 50.795, lng: -1.123 },
  { name: "Petersfield", lat: 51.004, lng: -0.936 },
  { name: "Romsey", lat: 50.989, lng: -1.499 },
  { name: "Alton", lat: 51.149, lng: -0.976 },
  { name: "Lymington", lat: 50.758, lng: -1.543 },
  { name: "Fleet", lat: 51.284, lng: -0.843 },
  { name: "Aldershot", lat: 51.248, lng: -0.759 },
  { name: "Farnborough", lat: 51.294, lng: -0.753 },
  { name: "Whitchurch", lat: 51.23, lng: -1.34 },
  { name: "Bishop's Waltham", lat: 50.954, lng: -1.212 },
  { name: "Stockbridge", lat: 51.113, lng: -1.49 },
  { name: "Ringwood", lat: 50.846, lng: -1.79 },
  { name: "New Milton", lat: 50.756, lng: -1.658 },
  { name: "Hythe", lat: 50.868, lng: -1.399 },
  { name: "Portsmouth", lat: 50.805, lng: -1.087 },
  { name: "Southampton", lat: 50.9097, lng: -1.4044 },
  { name: "Havant", lat: 50.851, lng: -0.982 },
  { name: "Waterlooville", lat: 50.88, lng: -1.03 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  // ── Categories (parents then children) ──
  for (const c of CATEGORIES) {
    const slug = slugify(c.name);
    const [parent] = await db
      .insert(categories)
      .values({ slug, name: c.name, blurb: c.blurb })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { name: c.name, blurb: c.blurb },
      })
      .returning();

    for (const childName of c.children) {
      await db
        .insert(categories)
        .values({ slug: slugify(childName), name: childName, parentId: parent.id })
        .onConflictDoUpdate({
          target: categories.slug,
          set: { name: childName, parentId: parent.id },
        });
    }
  }
  console.log(`✓ seeded ${CATEGORIES.length} categories (+ children)`);

  // ── Locations ──
  for (const t of TOWNS) {
    await db
      .insert(locations)
      .values({ slug: slugify(t.name), name: t.name, centroidLat: t.lat, centroidLng: t.lng })
      .onConflictDoUpdate({
        target: locations.slug,
        set: { name: t.name, centroidLat: t.lat, centroidLng: t.lng },
      });
  }
  console.log(`✓ seeded ${TOWNS.length} Hampshire towns`);

  // ── Optional demo businesses ──
  if (process.argv.includes("--demo")) {
    await seedDemo(db);
  }

  await sql.end();
  console.log("✓ seed complete");
}

/** A few demo listings mirroring the mockup, so public pages have content. */
async function seedDemo(db: ReturnType<typeof drizzle>) {
  const cat = async (slug: string) =>
    (await db.select().from(categories).where(eq(categories.slug, slug)))[0];
  const loc = async (slug: string) =>
    (await db.select().from(locations).where(eq(locations.slug, slug)))[0];

  const demo = [
    {
      placeId: "demo-watercress-line-cafe",
      name: "The Watercress Line Café",
      status: "premium",
      catSlug: "cafes",
      locSlug: "alresford",
      content: {
        displayName: "The Watercress Line Café",
        tagline: "Café & Kitchen",
        description:
          "A seasonal kitchen on the platform at Alresford, cooking with Hampshire growers and the watercress beds a mile up the road. Walk-ins welcome on weekdays; the terrace books out on steam weekends.",
        priceBand: "££",
        postcode: "SO24 9JG",
        rating: 4.9,
        reviewCount: 214,
      },
    },
    {
      placeId: "demo-flint-and-fern",
      name: "Flint & Fern",
      status: "premium",
      catSlug: "florists",
      locSlug: "winchester",
      content: {
        displayName: "Flint & Fern",
        tagline: "Florist & Plant Shop",
        description: "Seasonal British flowers, grown and arranged in the city.",
        rating: 4.9,
        reviewCount: 156,
      },
    },
    {
      placeId: "demo-gauntlett-and-sons",
      name: "Gauntlett & Sons",
      status: "premium",
      catSlug: "plumbers",
      locSlug: "andover",
      content: {
        displayName: "Gauntlett & Sons",
        tagline: "Plumbing & Heating",
        description: "Family heating engineers, Andover since 1987.",
        rating: 4.8,
        reviewCount: 96,
      },
    },
    {
      placeId: "demo-no-website-sparks",
      name: "Brightwell Electrical",
      status: "prospect",
      catSlug: "electricians",
      locSlug: "eastleigh",
      content: null,
      enrich: { hasWebsite: false, leadType: ["web-design"], score: 80 },
    },
  ];

  for (const d of demo) {
    const c = await cat(d.catSlug);
    const l = await loc(d.locSlug);
    const [biz] = await db
      .insert(businesses)
      .values({
        placeId: d.placeId,
        slug: slugify(d.name),
        name: d.name,
        status: d.status,
        categoryId: c?.id,
        locationId: l?.id,
        lat: l?.centroidLat,
        lng: l?.centroidLng,
        latCachedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: businesses.placeId,
        set: { status: d.status, categoryId: c?.id, locationId: l?.id },
      })
      .returning();

    if (d.content) {
      await db
        .insert(listingContent)
        .values({ businessId: biz.id, ...d.content })
        .onConflictDoUpdate({
          target: listingContent.businessId,
          set: { ...d.content, updatedAt: dsql`now()` },
        });
    }
    if (d.enrich) {
      await db
        .insert(enrichment)
        .values({ businessId: biz.id, ...d.enrich, checkedAt: new Date() })
        .onConflictDoUpdate({
          target: enrichment.businessId,
          set: { ...d.enrich, checkedAt: new Date() },
        });
    }
  }
  console.log(`✓ seeded ${demo.length} demo businesses`);
}

main().catch((err) => {
  console.error("✗ seed failed:", err);
  process.exit(1);
});
