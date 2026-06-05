# HantsLocal

A self-hosted, owned-end-to-end directory of Hampshire's trades, shops and
kitchens — built to read like a curated local publication, not a database dump.

This repo implements **all six phases (0–6)** of the master build spec:

- **Phase 0 — Foundations:** Next.js (App Router, TS) scaffold, the editorial
  design system, Drizzle schema + migrations, seed data, a live styleguide.
- **Phase 1 — Public directory:** the indexable SEO/GEO asset — home, town,
  category, town×category and business pages with ISR, `LocalBusiness` /
  `BreadcrumbList` JSON-LD, a programmatic sitemap and robots.
- **Phase 2 — Discovery + enrichment:** Places discovery → prospect upsert →
  async tech-fingerprint + local-rank enrichment → lead scoring.
- **Phase 3 — CRM + outreach:** admin prospect table, the confirm-your-details
  conversion flow, Brevo email sequences (PECR-aware), webhook + unsubscribe.
- **Phase 4 — Portal + monetisation:** Auth.js magic-link, business claiming,
  the owner listing editor with R2 photo upload, and Stripe subscriptions that
  flip a listing to the full-bleed Premium card.
- **Phase 5 — Reviews + premium features:** owner-imported Google reviews
  (attributed), photo gallery, enquiry capture, and owner analytics.
- **Phase 6 — Polish + scale:** 30-day lat/lng refresh cron, structured-data
  validation, GitHub Actions CI, and performance config.

## The data model in one line

Google place content can't be stored as our own (spec §0). So `businesses` keeps
only the `place_id` anchor + status machine; the **owned** `listing_content` is
what the public site renders; transient Google details are live-fetched with
attribution for unclaimed listings. The "confirm your details" flow (Phase 3)
converts transient Google data into owned, indexable content.

## Stack

Next.js 16 · TypeScript · Tailwind v4 · PostgreSQL 16 · Drizzle ORM ·
Places API (New) · SerpAPI · in-process tech fingerprinting.

## Getting started

```bash
pnpm install

# 1. Postgres — either docker compose, or a local Postgres 16 cluster.
docker compose up -d            # → postgres on localhost:5432
cp .env.example .env            # DATABASE_URL already matches the compose default

# 2. Schema + seed
pnpm db:generate                # generate SQL migration from schema.ts (committed)
pnpm db:migrate                 # apply migrations
pnpm db:seed -- --demo          # categories + Hampshire towns (+ demo listings)

# 3. Run
pnpm dev                        # http://localhost:3000  (styleguide at /styleguide)
```

> No external API keys are needed in dev: the Places / SerpAPI / crawl adapters
> fall back to deterministic **mock mode** when their keys are absent.

**Deploying to a server?** See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — a
step-by-step guide to wiring up Postgres, Coolify, and each external service
(Places, Brevo + DNS, Stripe, R2, n8n schedules), with a go-live checklist.

## Discovery & enrichment (Phase 2)

```bash
pnpm discover -- --towns winchester,andover --cats plumbers,cafes
pnpm enrich
```

Or via the secured HTTP endpoints that n8n drives on a schedule — see
[`docs/n8n.md`](docs/n8n.md).

## Scripts

| Command            | Does                                                |
|--------------------|-----------------------------------------------------|
| `pnpm dev`         | Dev server                                          |
| `pnpm build`       | Production build (prerenders the page matrix)       |
| `pnpm db:generate` | Generate a Drizzle migration from `schema.ts`       |
| `pnpm db:migrate`  | Apply migrations                                    |
| `pnpm db:seed`     | Seed categories + towns (`-- --demo` adds listings) |
| `pnpm db:studio`   | Drizzle Studio                                      |
| `pnpm discover`    | Run discovery worker (CLI)                          |
| `pnpm enrich`      | Drain the enrich queue (CLI)                        |

## Layout

```
src/
  app/
    (public)/        # directory: home, [segment], [segment]/[sub], business/[slug], towns, categories, styleguide
    (portal)/        # owner portal — placeholder (Phase 4)
    (admin)/         # prospect pipeline overview (full CRM = Phase 3)
    api/workers/     # secured discovery / enrich / queue-tick endpoints
    sitemap.ts robots.ts
  components/        # Header, Footer, ListingRow, PremiumCard, Badge, …
  db/                # Drizzle schema + client
  lib/
    integrations/    # places, serpapi, crawl, fingerprints
    workers/         # discovery, enrich (shared by API + CLI)
    queries.ts jsonld.tsx scoring.ts config.ts
scripts/             # migrate, seed, discover, enrich
drizzle/             # generated migrations
```

## Not yet wired

Live external services run in **mock mode** until keys are provided (Places,
SerpAPI, Brevo, Stripe, R2, GBP OAuth) — see `.env.example`. The optional
network-of-sites stamping (town-level microsites) from the spec is left as a
future extension; the engine is structured to support it.
