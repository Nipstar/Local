import type { Metadata } from "next";
import { db } from "@/db";
import { businesses, enrichment } from "@/db/schema";
import { sql } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

/**
 * Minimal prospect overview. The full CRM (filterable prospect table, detail
 * drawer, status transitions, activity timeline) is Phase 3 — this shows the
 * Phase 2 pipeline is populating.
 */
export default async function AdminPage() {
  const [byStatus, leadTypes] = await Promise.all([
    db
      .select({ status: businesses.status, count: sql<number>`count(*)::int` })
      .from(businesses)
      .groupBy(businesses.status),
    db
      .select({
        leadType: sql<string>`unnest(${enrichment.leadType})`,
        count: sql<number>`count(*)::int`,
      })
      .from(enrichment)
      .groupBy(sql`unnest(${enrichment.leadType})`),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
      <p className="font-data text-xs uppercase tracking-widest text-green">
        Admin · pipeline
      </p>
      <h1 className="mt-3 text-4xl text-ink">Prospects</h1>

      <h2 className="mt-12 text-xl text-ink">By status</h2>
      <Table
        rows={byStatus.map((r) => [r.status, r.count])}
        empty="No businesses yet — run discovery."
      />

      <h2 className="mt-12 text-xl text-ink">By lead type</h2>
      <Table
        rows={leadTypes.map((r) => [r.leadType, r.count])}
        empty="No enrichment yet — run the enrich worker."
      />
    </div>
  );
}

function Table({
  rows,
  empty,
}: {
  rows: [string, number][];
  empty: string;
}) {
  if (rows.length === 0)
    return <p className="mt-3 text-sm text-ink-soft">{empty}</p>;
  return (
    <table className="font-data mt-3 w-full max-w-sm text-sm">
      <tbody>
        {rows.map(([label, count]) => (
          <tr key={label} className="border-b border-line">
            <td className="py-2 text-ink">{label}</td>
            <td className="py-2 text-right text-ink-soft">{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
