/**
 * CLI: outreach sequences (spec Phase 3). Mirrors POST /api/workers/outreach.
 *
 *   pnpm outreach -- --seed-contacts     # demo: synthesise contacts for prospects
 *   pnpm outreach                        # run next step of "Confirm your details"
 *   pnpm outreach -- --campaign "Q3 push" --limit 50
 */
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { businesses, outreachContacts } from "../src/db/schema";
import { ensureContact, getOrCreateCampaign, runCampaignStep } from "../src/lib/outreach";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function seedContacts() {
  // Prospects/contacted with no contact yet → synthesise a demo contact.
  const rows = await db
    .select({ id: businesses.id, slug: businesses.slug })
    .from(businesses)
    .leftJoin(outreachContacts, eq(outreachContacts.businessId, businesses.id))
    .where(inArray(businesses.status, ["prospect", "contacted"]))
    .then((r) => r);

  const needing = [];
  for (const r of rows) {
    const existing = await db
      .select({ id: outreachContacts.id })
      .from(outreachContacts)
      .where(eq(outreachContacts.businessId, r.id))
      .limit(1);
    if (!existing[0]) needing.push(r);
  }

  for (const r of needing) {
    await ensureContact(r.id, { email: `owner+${r.slug}@example.com`, entityType: "ltd" });
  }
  console.log(`✓ seeded ${needing.length} demo contacts`);
}

async function main() {
  if (has("seed-contacts")) {
    await seedContacts();
    process.exit(0);
  }

  const name = arg("campaign") ?? "Confirm your details";
  const limit = arg("limit") ? Number(arg("limit")) : 200;
  const campaignId = await getOrCreateCampaign(name);
  console.log(`→ outreach step for "${name}"`);
  const summary = await runCampaignStep(campaignId, { limit });
  console.log("✓ outreach step complete", summary);
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ outreach failed:", e);
  process.exit(1);
});
