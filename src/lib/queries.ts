/**
 * Typed read queries for the public directory. Everything the public site
 * renders comes from the OWNED layer (listing_content) joined onto the
 * businesses anchor (spec §0). Transient Google details for unclaimed
 * prospects are layered in at request time by the Places adapter, never here.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  categories,
  listingContent,
  locations,
} from "@/db/schema";

/** The flat shape both ListingRow and PremiumCard consume. */
export type ListingView = {
  slug: string;
  name: string;
  displayName: string | null;
  tagline: string | null;
  description: string | null;
  status: string;
  rating: number | null;
  reviewCount: number | null;
  priceBand: string | null;
  postcode: string | null;
  photos: string[] | null;
  category: { name: string; slug: string } | null;
  location: { name: string; slug: string } | null;
  isPremium: boolean;
  isVerified: boolean;
};

const cat = categories;
const loc = locations;

const baseSelect = {
  slug: businesses.slug,
  name: businesses.name,
  status: businesses.status,
  displayName: listingContent.displayName,
  tagline: listingContent.tagline,
  description: listingContent.description,
  rating: listingContent.rating,
  reviewCount: listingContent.reviewCount,
  priceBand: listingContent.priceBand,
  postcode: listingContent.postcode,
  photos: listingContent.photos,
  catName: cat.name,
  catSlug: cat.slug,
  locName: loc.name,
  locSlug: loc.slug,
};

type Row = {
  slug: string;
  name: string;
  status: string;
  displayName: string | null;
  tagline: string | null;
  description: string | null;
  rating: number | null;
  reviewCount: number | null;
  priceBand: string | null;
  postcode: string | null;
  photos: unknown;
  catName: string | null;
  catSlug: string | null;
  locName: string | null;
  locSlug: string | null;
};

function toView(r: Row): ListingView {
  return {
    slug: r.slug,
    name: r.name,
    displayName: r.displayName,
    tagline: r.tagline,
    description: r.description,
    status: r.status,
    rating: r.rating,
    reviewCount: r.reviewCount,
    priceBand: r.priceBand,
    postcode: r.postcode,
    photos: Array.isArray(r.photos) ? (r.photos as string[]) : null,
    category: r.catName && r.catSlug ? { name: r.catName, slug: r.catSlug } : null,
    location: r.locName && r.locSlug ? { name: r.locName, slug: r.locSlug } : null,
    isPremium: r.status === "premium",
    isVerified: ["confirmed", "claimed", "premium"].includes(r.status),
  };
}

/** Premium first, then by rating — the upsell gap is visible (spec §2). */
const ORDER = [
  sql`case when ${businesses.status} = 'premium' then 0 else 1 end`,
  desc(listingContent.rating),
];

function joined() {
  return db
    .select(baseSelect)
    .from(businesses)
    .leftJoin(listingContent, eq(listingContent.businessId, businesses.id))
    .leftJoin(cat, eq(cat.id, businesses.categoryId))
    .leftJoin(loc, eq(loc.id, businesses.locationId));
}

/** Suppressed businesses never appear publicly. */
const visible = sql`${businesses.status} <> 'suppressed'`;

export async function getListingBySlug(slug: string): Promise<ListingView | null> {
  const rows = await joined().where(eq(businesses.slug, slug)).limit(1);
  return rows[0] ? toView(rows[0]) : null;
}

export async function listByLocation(
  locationSlug: string,
  limit = 60,
): Promise<ListingView[]> {
  const rows = await joined()
    .where(and(eq(loc.slug, locationSlug), visible))
    .orderBy(...ORDER)
    .limit(limit);
  return rows.map(toView);
}

export async function listByCategory(
  categorySlug: string,
  limit = 60,
): Promise<ListingView[]> {
  const rows = await joined()
    .where(and(eq(cat.slug, categorySlug), visible))
    .orderBy(...ORDER)
    .limit(limit);
  return rows.map(toView);
}

export async function listByLocationAndCategory(
  locationSlug: string,
  categorySlug: string,
  limit = 60,
): Promise<ListingView[]> {
  const rows = await joined()
    .where(and(eq(loc.slug, locationSlug), eq(cat.slug, categorySlug), visible))
    .orderBy(...ORDER)
    .limit(limit);
  return rows.map(toView);
}

export async function listFeatured(limit = 6): Promise<ListingView[]> {
  const rows = await joined()
    .where(and(eq(businesses.status, "premium"), visible))
    .orderBy(...ORDER)
    .limit(limit);
  return rows.map(toView);
}

// ─── Taxonomy lookups ────────────────────────────────────────────────────────
export async function getLocationBySlug(slug: string) {
  return (await db.select().from(loc).where(eq(loc.slug, slug)).limit(1))[0] ?? null;
}

export async function getCategoryBySlug(slug: string) {
  return (await db.select().from(cat).where(eq(cat.slug, slug)).limit(1))[0] ?? null;
}

export async function allLocations() {
  return db.select().from(loc).orderBy(loc.name);
}

/** Top-level categories (no parent) with a live count of visible listings. */
export async function topCategoriesWithCounts() {
  return db
    .select({
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      blurb: cat.blurb,
      count: sql<number>`count(${businesses.id})::int`,
    })
    .from(cat)
    .leftJoin(
      businesses,
      and(eq(businesses.categoryId, cat.id), visible),
    )
    .where(sql`${cat.parentId} is null`)
    .groupBy(cat.id)
    .orderBy(cat.name);
}

export async function allCategories() {
  return db.select().from(cat).orderBy(cat.name);
}

// ─── Business detail (full owned record + Google anchor) ────────────────────
export type BusinessDetail = ListingView & {
  placeId: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  hours: unknown;
  services: string[] | null;
  social: unknown;
  /** True once the owner has confirmed/claimed — render purely from owned data. */
  isOwned: boolean;
};

export async function getBusinessDetail(
  slug: string,
): Promise<BusinessDetail | null> {
  const rows = await db
    .select({
      ...baseSelect,
      placeId: businesses.placeId,
      phone: listingContent.phone,
      email: listingContent.email,
      website: listingContent.website,
      address: listingContent.address,
      hours: listingContent.hours,
      services: listingContent.services,
      social: listingContent.social,
    })
    .from(businesses)
    .leftJoin(listingContent, eq(listingContent.businessId, businesses.id))
    .leftJoin(cat, eq(cat.id, businesses.categoryId))
    .leftJoin(loc, eq(loc.id, businesses.locationId))
    .where(eq(businesses.slug, slug))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  const view = toView(r);
  return {
    ...view,
    placeId: r.placeId,
    phone: r.phone,
    email: r.email,
    website: r.website,
    address: r.address,
    hours: r.hours,
    services: r.services ?? null,
    social: r.social,
    isOwned: ["confirmed", "claimed", "premium"].includes(r.status),
  };
}

/** Slugs for generateStaticParams. */
export async function allListingSlugs() {
  const rows = await db
    .select({ slug: businesses.slug })
    .from(businesses)
    .where(visible);
  return rows.map((r) => r.slug);
}
