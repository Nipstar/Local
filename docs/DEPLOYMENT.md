# Deploying HantsLocal

How to take this repo from a mock-mode dev build to a live, revenue-ready
directory on your own server. Read top to bottom the first time; after that it's
a reference.

## TL;DR — is it ready?

Yes, with the usual caveats of a self-hosted app:

- **All six phases are built and the app builds/runs clean.** With *no* API keys
  it runs fully in **mock mode** — so you can deploy first and wire services in
  one at a time without anything crashing.
- **To actually transact you wire real keys** (Postgres is the only hard
  requirement; everything else degrades to mock until its key is present).
- **Three things to decide/finish before a public launch** — see
  [Before you go public](#before-you-go-public). None block an internal/staging
  deploy.

---

## 0. Prerequisites

- A server you control (the spec assumes **Contabo + Coolify**, but any Docker/
  Node host works). Node 22, pnpm 10.
- **PostgreSQL 16** reachable from the app.
- A domain (e.g. `hantslocal.co.uk`) with DNS you can edit.
- Accounts, as you turn each feature on: Google Cloud (Places), SerpAPI, Brevo,
  Stripe, Cloudflare (R2), and an n8n instance for scheduling.

---

## 1. Database

Create a database and user, then point `DATABASE_URL` at it:

```
DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/hantslocal"
```

On the server, from the repo (or a one-off job):

```bash
pnpm install
pnpm db:migrate        # apply drizzle/*.sql
pnpm db:seed           # categories + Hampshire towns (NO --demo in prod)
```

> `--demo` inserts fake listings — only use it on staging.

`crawl_jobs` is the async queue; there's no Redis to run.

---

## 2. First deploy (Coolify)

Create an **Application** from this Git repo on the working branch.

- **Build command:** `pnpm install && pnpm build`
- **Start command:** `pnpm start` (Next listens on `:3000`)
- **Post-deploy / release command:** `pnpm db:migrate` (so each deploy applies
  new migrations before serving)
- **Health check:** `GET /` → 200
- Attach the Postgres service (or use an external `DATABASE_URL`).
- Add the env vars from §3. Point your domain at the app and let Coolify issue
  TLS.

The same image is the web app *and* the worker runtime — n8n just calls its HTTP
endpoints (§7). There's no separate worker process to run.

---

## 3. Environment variables

Copy `.env.example` and fill what you need. Anything left blank → that adapter
runs in mock mode.

| Var | Required? | What it's for / where to get it |
|---|---|---|
| `DATABASE_URL` | **Yes** | Postgres connection string. |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | Public base URL, e.g. `https://hantslocal.co.uk`. Used for canonical tags, sitemap, JSON-LD, email links. |
| `AUTH_SECRET` | **Yes (for portal)** | `openssl rand -base64 32`. Signs Auth.js sessions (also the GBP OAuth state). |
| `ADMIN_EMAILS` | **Yes (for admin)** | Comma-separated emails allowed into `/admin`. **Unset in production = no admin access.** |
| `EMAIL_FROM` | Recommended | From-address for all email; must be a **verified Brevo sender** (§5). |
| `N8N_WEBHOOK_SECRET` | **Yes (for workers)** | Random string; n8n sends it as the `X-Worker-Secret` header. Without it `/api/workers/*` return 503. |
| `PLACES_API_KEY` | Optional | Google Places API (New). Enables discovery + live details on unclaimed listings. |
| `SERPAPI_KEY` | Optional | SerpAPI; local 3-pack rank during enrichment. |
| `PUPPETEER_EXECUTABLE_PATH` | Optional | Path to system Chromium for JS-rendered crawls. Blank → HTTP-fetch fingerprinting (still works). |
| `BREVO_API_KEY` | Optional | Transactional email (outreach + magic links). Blank → emails log to console. |
| `STRIPE_SECRET_KEY` | Optional | Live subscriptions. Blank → mock upgrade applies premium directly. |
| `STRIPE_WEBHOOK_SECRET` | with Stripe | Verifies `/api/webhooks/stripe`. |
| `STRIPE_PRICE_STANDARD` / `STRIPE_PRICE_PREMIUM` | with Stripe | Price IDs of your two products. |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_PUBLIC_URL` | Optional | Cloudflare R2 photo storage. Blank → uploads return a placeholder URL. |
| `GBP_CLIENT_ID` / `GBP_CLIENT_SECRET` | Optional | Google Business Profile OAuth for premium review import (see §9). |

After changing env in Coolify, redeploy (Next inlines `NEXT_PUBLIC_*` at build).

---

## 4. Google Places API (discovery + live details)

1. Google Cloud Console → new project → enable **Places API (New)**.
2. Create an API key; restrict it to the Places API (and your server IP if you can).
3. Set `PLACES_API_KEY`.

Cost control: discovery is the only heavy caller — shard it (§7). Remember §0 —
we persist only `place_id`; lat/lng is refreshed on the 30-day cron, everything
else is fetched live with attribution.

`SERPAPI_KEY` (serpapi.com) is the same idea for the local-pack rank signal;
optional.

---

## 5. Brevo (email) + DNS

1. Brevo → create an API key → `BREVO_API_KEY`.
2. Add a **sending domain** (ideally a dedicated subdomain, e.g.
   `mail.hantslocal.co.uk`) and verify it with the **SPF, DKIM and DMARC** DNS
   records Brevo gives you. This is essential for deliverability and is a PECR
   expectation for the outreach sequences.
3. Set `EMAIL_FROM` to an address on that verified domain (e.g.
   `hello@hantslocal.co.uk`). Both the magic-link sign-in and the outreach
   sequence send from here.
4. (Optional) Add a Brevo webhook → `https://YOUR_DOMAIN/api/webhooks/brevo`
   for `opened`, `click`, `unsubscribe` events; they're written back to
   `outreach_messages` / opt-outs.

Warm the sending domain (ramp volume gradually) before large sends.

---

## 6. Stripe (subscriptions)

1. Create two recurring **Products/Prices**: Standard and Premium. Copy the
   `price_…` IDs into `STRIPE_PRICE_STANDARD` / `STRIPE_PRICE_PREMIUM`.
2. `STRIPE_SECRET_KEY` from the dashboard.
3. Add a webhook endpoint → `https://YOUR_DOMAIN/api/webhooks/stripe`, listening
   for `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy its signing secret →
   `STRIPE_WEBHOOK_SECRET`.
4. Enable the **Customer Portal** in Stripe (Billing → Customer portal); the
   "Manage billing" button uses it.

Behaviour: premium price → `status = premium` (full-bleed card); standard →
`claimed`; cancellation demotes to `claimed`. With no Stripe key, the upgrade
button applies premium directly (handy for staging).

---

## 7. Cloudflare R2 (photos)

1. Create an R2 bucket; create an API token (access key id + secret).
2. Expose the bucket publicly (an `r2.dev` URL or, better, a custom domain like
   `img.hantslocal.co.uk`).
3. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
   `R2_PUBLIC_URL`. The public host is auto-allow-listed for `next/image`.

---

## 8. n8n (scheduling the workers)

The app exposes the workers as HTTP endpoints; n8n triggers them on a schedule.
Every call needs the header `X-Worker-Secret: $N8N_WEBHOOK_SECRET`.

| Endpoint | Suggested schedule | Body |
|---|---|---|
| `POST /api/workers/discovery` | weekly, sharded | `{ "townSlugs": [...], "limitPairs": 12 }` |
| `POST /api/workers/queue/tick` | every 2–5 min | `{ "batch": 25 }` |
| `POST /api/workers/outreach` | daily | `{ "campaign": "Confirm your details" }` |
| `POST /api/workers/refresh-geo` | daily | `{ "olderThanDays": 30 }` |

Full contract + an example node in [`docs/n8n.md`](./n8n.md). You can also run
any of these from the CLI on the box: `pnpm discover`, `pnpm enrich`,
`pnpm outreach`, `pnpm refresh-geo`.

---

## 9. Google Business Profile reviews (premium, optional)

Phase 5 review import is **premium-gated**. The owner OAuth connect flow is
wired end-to-end:

1. Create an OAuth client (`GBP_CLIENT_ID` / `GBP_CLIENT_SECRET`) with the
   `business.manage` scope and redirect URI `https://YOUR_DOMAIN/api/gbp/callback`.
2. With those set, the listing editor shows **Connect Google** → consent →
   tokens are stored (refreshed automatically) in `gbp_connections`.

One seam remains before real reviews flow: the live **My Business v4
`accounts.locations.reviews`** call (marked in `fetchOwnerReviews()` in
`src/lib/integrations/gbp.ts`). It needs your Google project allow-listed by
Google and a `place_id → GBP location` mapping. Until that's enabled, a
connected account still imports **sample** reviews rather than erroring.

Never import reviews for unclaimed businesses — that's a hard guardrail (§0).

---

## 10. Go-live checklist

- [ ] `DATABASE_URL` set; `pnpm db:migrate` run; `pnpm db:seed` (no `--demo`).
- [ ] `NEXT_PUBLIC_SITE_URL` = your https domain; TLS issued.
- [ ] `AUTH_SECRET` set; sign-in magic link arrives (real email once Brevo is on).
- [ ] Brevo sending domain verified (SPF/DKIM/DMARC); `EMAIL_FROM` on that domain.
- [ ] Stripe products + webhook + customer portal configured; a test checkout
      flips a listing to premium.
- [ ] R2 bucket + public URL; a photo upload appears on the listing.
- [ ] `N8N_WEBHOOK_SECRET` set; n8n schedules created and returning `200`.
- [ ] `/sitemap.xml`, `/robots.txt`, and a `/business/[slug]` page validate
      (`BASE_URL=https://YOUR_DOMAIN pnpm validate:sd`, or Google Rich Results).
- [ ] **Admin gated** (see below).

---

## Before you go public

These were the pre-launch hardening items — now addressed, with one thing left
for you to configure and one external dependency:

1. **`/admin` is gated.** Access requires a signed-in user whose email is in
   `ADMIN_EMAILS` (page guard + every admin action checks it). It **fails
   closed in production** — so remember to set `ADMIN_EMAILS`, or no one gets
   in. (In dev it stays open when the list is unset.)
2. **Claiming is hardened.** Self-serve "Is this your business?" only
   auto-verifies when the claimant's email domain matches the business website
   domain; otherwise the claim is **pending** until an admin approves it from
   the prospect detail page. (Admin-sent confirm links remain trusted.)
3. **GBP live reviews** — the owner OAuth connect flow is wired (§9); the final
   live `reviews` API call needs Google project allow-listing. Connected
   accounts import sample data until then.

Everything else (the public directory, discovery/enrichment, outreach + confirm
flow, portal, Stripe, R2, analytics, the geo cron, CI) is production-shaped and
verified end-to-end in mock mode.

---

## CI

`.github/workflows/ci.yml` runs lint + typecheck + build + the structured-data
gate against a Postgres service on every push. Use it as the gate before
deploys; Coolify can auto-deploy on green `main`.
