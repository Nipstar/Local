# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**HantsLocal** — a self-hosted, owned-end-to-end directory of Hampshire's
trades, shops and kitchens. Built from a 6-phase master spec to replace a rented
GHL directory stack. Editorial-modern, reads like a curated local publication.

## The one principle that shapes the data model (spec §0)

Google place content **cannot** be stored as our own directory data. Only
`place_id` is cacheable indefinitely; `lat/lng` for 30 days; everything else
(name beyond seed, phone, rating, reviews, photos) is transient — re-fetched or
owner-supplied, with Google attribution when displayed. So there are two tiers:

- **Transient Google layer** — `businesses` keyed on `place_id`; used for
  prospecting and to seed a claim. Never the source of truth for a public listing.
- **Owned layer** — `listing_content`; everything an owner confirms/edits. This
  is what the public directory renders and ranks on.

The "confirm your details" flow (Phase 3) is the mechanism that converts
transient Google data into owned, legally-clean, indexable content. Build around it.

## Stack

Next.js 16 (App Router, TS) · Tailwind v4 (CSS-first tokens) · PostgreSQL 16 ·
Drizzle ORM · Auth.js magic-link (Phase 4) · Stripe (Phase 4) · Brevo (Phase 3) ·
Places API (New) · SerpAPI · in-process tech fingerprinting · Cloudflare R2
(Phase 4) · n8n orchestration · Coolify deploy.

## Conventions

- **Design tokens** live in `src/app/globals.css` (`:root` + Tailwind `@theme`).
  Use `bg-paper`, `text-ink`, `text-green`, `text-ink-soft`, `border-line`,
  `font-display`, `font-data`, `rounded-[var(--radius-base)]`. **Avoid**
  Inter/Roboto, purple gradients, identical card grids, generic SaaS hero.
- **Brand** is `SITE` in `src/lib/config.ts` — never hard-code "HantsLocal".
- **All public reads** go through `src/lib/queries.ts` and render owned data
  first. Transient Google details are live-fetched at request time with
  attribution (see `src/app/(public)/business/[slug]/page.tsx`).
- **External integrations** (`src/lib/integrations/*`) always have a **mock
  mode** that activates when the API key is absent, so everything runs keyless
  in dev. Preserve this when adding integrations.
- **Workers** core logic lives in `src/lib/workers/*` and is shared by both the
  secured `/api/workers/*` routes (n8n-driven, guarded by `X-Worker-Secret`) and
  the `scripts/*` CLIs. Keep that split.
- **Routing note:** Next forbids two same-level dynamic siblings, so town and
  category share one `[segment]` resolver (`src/app/(public)/[segment]/`),
  with `[segment]/[sub]` for town×category.

## Commands

```bash
pnpm dev / build / lint
pnpm db:generate          # Drizzle migration from src/db/schema.ts (commit it)
pnpm db:migrate           # apply migrations  (tsx scripts/migrate.ts)
pnpm db:seed -- --demo    # categories + Hampshire towns (+ demo listings)
pnpm db:studio
pnpm discover -- --towns winchester,andover --cats plumbers,cafes
pnpm enrich
```

Postgres: `docker compose up -d` (or a local PG16 cluster). `DATABASE_URL` in
`.env` matches the compose defaults. Copy `.env.example` → `.env`.

## Database

Schema is `src/db/schema.ts`; the **full spec §3** is migrated up front (Phase 3+
tables exist before their features). After editing the schema, run `pnpm
db:generate` and commit the generated `drizzle/*.sql`. `crawl_jobs` is a
DB-backed async queue (no Redis in the stack).

Business `status` lifecycle: `prospect → contacted → confirmed → claimed →
premium`, plus `suppressed` (never shown publicly).

## Phase status

- ✅ Phase 0 — Foundations (scaffold, design system, schema, seed, styleguide)
- ✅ Phase 1 — Public directory (page matrix, JSON-LD, sitemap, ISR)
- ✅ Phase 2 — Discovery + enrichment (Places/SerpAPI/crawl, scoring, workers)
- ✅ Phase 3 — CRM + outreach + confirm-your-details flow
- ✅ Phase 4 — Portal: Auth.js magic-link, claim, listing editor + R2 photos, Stripe subscriptions
- ⬜ Phase 5 — GBP reviews + premium features
- ⬜ Phase 6 — Performance, lat/lng refresh cron, CI structured-data validation

### Phase 4 notes
- Auth.js (next-auth v5) magic-link via `src/auth.ts`; database sessions
  (Drizzle adapter). The verification email goes through Brevo (mock mode logs
  the magic link — and any email link — to the server console). Needs `AUTH_SECRET`.
- Owner→business ownership is a verified `claims` row (`claims.userId`). Claiming
  trusts the signed-in user for now; stronger proof (email-domain/GBP) is future.
- Stripe Checkout + hosted Customer Portal + webhook (`/api/webhooks/stripe`).
  Mock mode (no `STRIPE_SECRET_KEY`) applies upgrades directly so premium is
  testable. `premium` tier → business.status `premium` (full-bleed card);
  `standard` → `claimed`; cancel → demote to `claimed` (see `src/lib/billing.ts`).
- R2 photo upload (`src/lib/integrations/r2.ts`) uses the S3 SDK in live mode,
  returns a placeholder URL in mock mode.

## Guardrails

- Never bulk-scrape or persist Google reviews/ratings/photos. Reviews come only
  from owner GBP OAuth (Phase 5), stored with attribution.
- `/admin` and `/portal` are robots-disallowed. Admin auth lands in Phase 4
  (Auth.js); until then admin is open by design per the spec's sequencing.
- Don't commit `.env`, `.pgdata`, or `node_modules`.
- Don't create PRs unless explicitly asked; push to the working branch.
