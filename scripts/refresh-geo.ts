/**
 * CLI: refresh stale lat/lng (spec §0 30-day compliance). Mirrors
 * POST /api/workers/refresh-geo.
 *
 *   pnpm refresh-geo                 # refresh rows older than 30 days
 *   pnpm refresh-geo -- --days 0     # force-refresh everything (testing)
 */
import "dotenv/config";
import { refreshStaleGeo } from "../src/lib/workers/geo";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const days = arg("days") != null ? Number(arg("days")) : 30;
  const limit = arg("limit") ? Number(arg("limit")) : undefined;
  console.log(`→ refreshing geo older than ${days} days`);
  const summary = await refreshStaleGeo({ olderThanDays: days, limit });
  console.log("✓ geo refresh complete", summary);
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ geo refresh failed:", e);
  process.exit(1);
});
