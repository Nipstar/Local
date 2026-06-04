/**
 * Central configuration. The brand lives in one place (`SITE`) so it can be
 * swapped once the final domain is chosen, per the master spec's {{PROJECT}}
 * placeholder. `env` is a typed, lazy accessor over process.env.
 */
import "dotenv/config";

export const SITE = {
  name: "HantsLocal",
  /** Used in the wordmark: "Hants" + "Local" with the second word accented. */
  wordmark: { lead: "Hants", tail: "Local" },
  tagline: "Find someone good, nearby.",
  description:
    "A curated directory of Hampshire's trades, shops and kitchens — checked, reviewed, and written up like the local publication it ought to be.",
  county: "Hampshire",
  get url() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
} as const;

/** Required at runtime — throws if missing (server-only). */
function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

/** Optional — returns undefined when blank/unset. */
function optional(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get placesApiKey() {
    return optional("PLACES_API_KEY");
  },
  get serpapiKey() {
    return optional("SERPAPI_KEY");
  },
  get puppeteerExecutablePath() {
    return optional("PUPPETEER_EXECUTABLE_PATH");
  },
  get workerSecret() {
    return optional("N8N_WEBHOOK_SECRET");
  },
};

/**
 * Feature flags derived from which integration keys are present. When a key is
 * absent the corresponding adapter runs in mock mode, so the whole platform is
 * runnable end-to-end in dev without live credentials.
 */
export const features = {
  /** Live-fetch transient Google details for unclaimed listings (spec §0). */
  get livePlaces() {
    return Boolean(env.placesApiKey);
  },
  get liveSerpapi() {
    return Boolean(env.serpapiKey);
  },
  get liveCrawl() {
    return Boolean(env.puppeteerExecutablePath);
  },
};
