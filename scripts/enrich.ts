/**
 * CLI: drain the enrich queue (crawl + fingerprint → pack rank → score).
 * Mirrors POST /api/workers/queue/tick. Loops until the queue is empty.
 *
 *   pnpm enrich               # process all queued jobs
 *   pnpm enrich -- --batch 10 # per-tick batch size
 */
import "dotenv/config";
import { runEnrichQueue } from "../src/lib/workers/enrich";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const batch = arg("batch") ? Number(arg("batch")) : 25;
  let total = 0;
  let errored = 0;
  // Drain the queue in batches.
  for (;;) {
    const s = await runEnrichQueue(batch);
    if (s.processed === 0 && s.errored === 0) break;
    total += s.processed;
    errored += s.errored;
    console.log(`  …tick processed ${s.processed}, errored ${s.errored}`);
  }
  console.log(`✓ enrichment complete: ${total} processed, ${errored} errored`);
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ enrichment failed:", e);
  process.exit(1);
});
