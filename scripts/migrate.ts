/**
 * Apply Drizzle migrations from ./drizzle against DATABASE_URL.
 *   pnpm db:generate   → write SQL migrations from schema.ts
 *   pnpm db:migrate    → apply them (this script)
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  console.log("→ applying migrations from ./drizzle …");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ migrations applied");

  await sql.end();
}

main().catch((err) => {
  console.error("✗ migration failed:", err);
  process.exit(1);
});
