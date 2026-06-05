/**
 * Database schema (master spec §3) implemented with Drizzle.
 *
 * Two-tier model (spec §0):
 *   - `businesses` is the Google anchor + status machine; `place_id` is the
 *     only Google value stored indefinitely.
 *   - `listing_content` is the OWNED layer — the source of truth the public
 *     site renders. Everything else Google-derived is transient / live-fetched.
 *
 * The full §3 schema is created up front (one migration). Phase 3+ tables
 * (outreach_*, campaigns, users, claims, subscriptions, activity_log) exist now
 * but are unused until those phases are built.
 */
import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// ─── Taxonomy ──────────────────────────────────────────────────────────────
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** One-line trade examples shown under the heading (e.g. "Plumbers · Electricians"). */
  blurb: text("blurb"),
  parentId: uuid("parent_id"),
});

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  centroidLat: doublePrecision("centroid_lat"),
  centroidLng: doublePrecision("centroid_lng"),
});

// ─── The Google anchor + status machine ──────────────────────────────────────
/** status: prospect | contacted | confirmed | claimed | premium | suppressed */
export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: text("place_id").notNull().unique(), // only Google value stored indefinitely
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(), // seeded from Google, becomes owned on confirm
    categoryId: uuid("category_id").references(() => categories.id),
    locationId: uuid("location_id").references(() => locations.id),
    lat: doublePrecision("lat"), // cache max 30 days, refresh on cron
    lng: doublePrecision("lng"),
    latCachedAt: timestamp("lat_cached_at", { withTimezone: true }),
    status: text("status").notNull().default("prospect"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("businesses_status_idx").on(t.status),
    index("businesses_cat_loc_idx").on(t.categoryId, t.locationId),
  ],
);

// ─── Owned content — source of truth for public rendering ───────────────────
export const listingContent = pgTable("listing_content", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  tagline: text("tagline"),
  description: text("description"),
  phone: text("phone"), // owner-confirmed, not Google
  email: text("email"),
  website: text("website"),
  address: text("address"),
  postcode: text("postcode"),
  priceBand: text("price_band"), // e.g. "££"
  hours: jsonb("hours"),
  services: text("services").array(),
  social: jsonb("social"),
  photos: jsonb("photos"), // R2 keys, owner-uploaded
  rating: doublePrecision("rating"), // owner/GBP-derived, not bulk-scraped
  reviewCount: integer("review_count"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Reviews: ONLY from owner GBP OAuth. Never bulk-scraped (Phase 5). ───────
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").references(() => businesses.id, {
    onDelete: "cascade",
  }),
  source: text("source").notNull().default("gbp"),
  authorName: text("author_name"),
  authorUrl: text("author_url"), // attribution required
  rating: integer("rating"),
  body: text("body"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow(),
});

// ─── Prospecting enrichment (Phase 2) ───────────────────────────────────────
export const enrichment = pgTable(
  "enrichment",
  {
    businessId: uuid("business_id")
      .primaryKey()
      .references(() => businesses.id, { onDelete: "cascade" }),
    hasWebsite: boolean("has_website"),
    tech: jsonb("tech"), // {cms, builder, frameworks[], chat, booking, pixels[], schema}
    packRank: jsonb("pack_rank"), // {keyword: position} per town centroid
    leadType: text("lead_type").array(), // web-design | chatbot | geo | automation | rip-replace
    score: integer("score"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
  },
  (t) => [index("enrichment_score_idx").on(t.score)],
);

// ─── Async crawl/discovery queue (not in §3; needed for Phase 2) ────────────
/** A DB-backed job queue so enrichment is async and never blocks discovery. */
export const crawlJobs = pgTable(
  "crawl_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(), // discovery | enrich
    status: text("status").notNull().default("queued"), // queued | running | done | error
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("crawl_jobs_status_type_idx").on(t.status, t.type)],
);

// ─── Premium: enquiries + analytics (Phase 5) ────────────────────────────────
export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    message: text("message"),
    handled: boolean("handled").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("enquiries_business_idx").on(t.businessId)],
);

/** Lightweight per-listing view counter (owner analytics). */
export const listingStats = pgTable("listing_stats", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  views: integer("views").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── CRM / outreach (Phase 3) ────────────────────────────────────────────────
export const outreachContacts = pgTable("outreach_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").references(() => businesses.id),
  email: text("email"),
  entityType: text("entity_type"), // ltd | llp | sole_trader  (PECR segmentation)
  consentBasis: text("consent_basis"),
  optedOut: boolean("opted_out").default(false),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  channel: text("channel"),
  status: text("status"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const outreachMessages = pgTable("outreach_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaigns.id),
  contactId: uuid("contact_id").references(() => outreachContacts.id),
  step: integer("step"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  brevoId: text("brevo_id"),
});

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").references(() => businesses.id),
  type: text("type"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Portal + monetisation (Phase 4) ─────────────────────────────────────────
// users + the Auth.js tables below match the @auth/drizzle-adapter shape.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id),
    userId: uuid("user_id").references(() => users.id),
    token: text("token").unique(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("claims_token_idx").on(t.token)],
);

/** Google Business Profile OAuth connection per owner (Phase 5 live reviews). */
export const gbpConnections = pgTable("gbp_connections", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").references(() => businesses.id),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubId: text("stripe_sub_id"),
  tier: text("tier"),
  status: text("status"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
});

// ─── Inferred types ──────────────────────────────────────────────────────────
export type Business = typeof businesses.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type ListingContent = typeof listingContent.$inferSelect;
export type Enrichment = typeof enrichment.$inferSelect;
export type CrawlJob = typeof crawlJobs.$inferSelect;

/** Business status values, in lifecycle order. */
export const BUSINESS_STATUS = [
  "prospect",
  "contacted",
  "confirmed",
  "claimed",
  "premium",
  "suppressed",
] as const;
export type BusinessStatus = (typeof BUSINESS_STATUS)[number];
