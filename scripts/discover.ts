/**
 * CLI: run discovery (Places Text Search → upsert prospects → enqueue enrich).
 * Mirrors POST /api/workers/discovery for local/verifiable runs.
 *
 *   pnpm discover                         # full sweep (all top categories × towns)
 *   pnpm discover -- --towns winchester,andover --cats plumbers
 *   pnpm discover -- --limit 4            # cap pairs (handy in mock mode)
 */
import "dotenv/config";
import { runDiscovery } from "../src/lib/workers/discovery";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const towns = arg("towns")?.split(",").filter(Boolean);
  const cats = arg("cats")?.split(",").filter(Boolean);
  const limit = arg("limit") ? Number(arg("limit")) : undefined;

  console.log("→ discovery", { towns, cats, limit });
  const summary = await runDiscovery({
    townSlugs: towns,
    categorySlugs: cats,
    limitPairs: limit,
  });
  console.log("✓ discovery complete", summary);
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ discovery failed:", e);
  process.exit(1);
});
