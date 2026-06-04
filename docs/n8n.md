# n8n wiring — discovery & enrichment

The app exposes the Phase 2 workers as secured HTTP endpoints. n8n (a separate
service on Contabo) drives them on a schedule. n8n itself is **not** provisioned
by this repo — this doc is the contract.

## Auth

Every `/api/workers/*` route requires the shared secret in a header:

```
X-Worker-Secret: <N8N_WEBHOOK_SECRET>
```

If `N8N_WEBHOOK_SECRET` is unset the routes fail closed (HTTP 503).

## Endpoints

| Method & path                  | Body (JSON)                                  | Does                                                                 |
|--------------------------------|----------------------------------------------|---------------------------------------------------------------------|
| `POST /api/workers/discovery`  | `{ categorySlugs?, townSlugs?, limitPairs? }`| Places Text Search (category × town) → upsert prospects → enqueue enrich jobs. Empty body = full sweep. |
| `POST /api/workers/queue/tick` | `{ batch?: number }` (default 25)            | Drains a batch of queued enrich jobs (crawl + fingerprint → pack rank → score). |
| `POST /api/workers/enrich`     | `{ businessId: string }`                     | Enrich one business synchronously (on-demand re-check).             |

All return `{ ok: true, summary }`.

## Suggested schedules

- **Discovery** — weekly, sharded so each run does a slice of the matrix
  (e.g. `limitPairs` per run, or rotate `townSlugs`). Keeps Places usage flat.
- **Queue tick** — every 2–5 minutes. Enrichment is async via the `crawl_jobs`
  table so discovery never blocks on it.
- **Lat/lng refresh** (Phase 6) — daily cron re-running discovery for rows whose
  `lat_cached_at` is older than 30 days (Google caching compliance, spec §0).

## Example n8n HTTP Request node

```
Method: POST
URL:    https://<host>/api/workers/discovery
Headers: X-Worker-Secret = {{$env.N8N_WEBHOOK_SECRET}}
Body (JSON): { "townSlugs": ["winchester","andover"], "limitPairs": 12 }
```

## Mock mode

Without `PLACES_API_KEY` / `SERPAPI_KEY`, the adapters return deterministic
fixtures, so the whole loop is runnable in dev. Locally you can skip n8n and use
the CLIs:

```
pnpm discover -- --towns winchester,andover --cats plumbers,cafes
pnpm enrich
```

## Crawl engine note

Tech fingerprinting runs in-process: an HTTP fetch of the homepage feeds the
ruleset in `src/lib/integrations/fingerprints.ts` (an in-TypeScript stand-in for
the Go `wappalyzergo` named in the spec — kept in-process, zero per-lookup
cost). For JS-rendered sites, set `PUPPETEER_EXECUTABLE_PATH` and swap the
`fetchHtml()` step in `src/lib/integrations/crawl.ts` for a headless render; the
fingerprint stage is unchanged.
