import type { Metadata } from "next";
import Link from "next/link";
import {
  listProspects,
  statusCounts,
  type ProspectFilters,
} from "@/lib/admin-queries";
import { allCategories, allLocations } from "@/lib/queries";
import { outreachStats } from "@/lib/outreach";
import { runCampaignAction } from "./actions";

export const metadata: Metadata = { title: "Prospects", robots: { index: false } };
export const dynamic = "force-dynamic";

const LEAD_TYPES = ["web-design", "chatbot", "geo", "automation", "rip-replace"];
const STATUSES = ["prospect", "contacted", "confirmed", "claimed", "premium", "suppressed"];

export default async function AdminProspectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters: ProspectFilters = {
    status: sp.status || undefined,
    town: sp.town || undefined,
    category: sp.category || undefined,
    leadType: sp.leadType || undefined,
    minScore: sp.minScore ? Number(sp.minScore) : undefined,
  };

  const [rows, counts, towns, cats, oStats] = await Promise.all([
    listProspects(filters, 200),
    statusCounts(),
    allLocations(),
    allCategories(),
    outreachStats(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl text-ink">Prospects</h1>
          <p className="font-data mt-2 text-xs uppercase tracking-wide text-ink-soft">
            {counts.map((c) => `${c.status} ${c.count}`).join("  ·  ")}
            {oStats && `  ·  contacts ${oStats.contacts} (${oStats.optedOut} opted out)`}
          </p>
        </div>
        <form action={runCampaignAction} className="flex items-center gap-2">
          <input
            name="campaign"
            defaultValue="Confirm your details"
            className="font-data rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2 text-xs"
          />
          <button className="rounded-[var(--radius-base)] bg-amber px-4 py-2 text-sm text-paper">
            Run campaign step →
          </button>
        </form>
      </div>

      {/* Filters */}
      <form className="font-data mt-8 grid gap-3 rounded-[var(--radius-base)] border border-line bg-paper-2 p-4 text-sm sm:grid-cols-5">
        <Select name="status" label="Status" value={sp.status} options={STATUSES} />
        <Select name="town" label="Town" value={sp.town} options={towns.map((t) => [t.slug, t.name])} />
        <Select
          name="category"
          label="Category"
          value={sp.category}
          options={cats.filter((c) => !c.parentId).map((c) => [c.slug, c.name])}
        />
        <Select name="leadType" label="Lead type" value={sp.leadType} options={LEAD_TYPES} />
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink-soft">Min score</span>
          <input
            name="minScore"
            type="number"
            defaultValue={sp.minScore}
            className="rounded-[var(--radius-base)] border border-line bg-paper px-2 py-1.5"
          />
        </label>
        <div className="flex items-end gap-2 sm:col-span-5">
          <button className="rounded-[var(--radius-base)] bg-green px-4 py-2 text-paper">Filter</button>
          <Link href="/admin" className="rounded-[var(--radius-base)] border border-line px-4 py-2 hover:bg-paper">
            Clear
          </Link>
        </div>
      </form>

      {/* Table */}
      <table className="mt-8 w-full text-sm">
        <thead className="font-data text-left text-xs uppercase tracking-wide text-ink-soft">
          <tr className="border-b border-line">
            <th className="py-2">Business</th>
            <th>Town</th>
            <th>Category</th>
            <th>Lead type</th>
            <th className="text-right">Score</th>
            <th>Status</th>
            <th>Contact</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line hover:bg-paper-2">
              <td className="py-2.5">
                <Link href={`/admin/business/${r.id}`} className="text-ink hover:text-green">
                  {r.name}
                </Link>
              </td>
              <td className="text-ink-soft">{r.town ?? "—"}</td>
              <td className="text-ink-soft">{r.category ?? "—"}</td>
              <td className="font-data text-xs text-ink-soft">{r.leadType?.join(", ") ?? "—"}</td>
              <td className="font-data text-right">{r.score ?? "—"}</td>
              <td className="font-data text-xs">{r.status}</td>
              <td className="font-data text-xs text-ink-soft">
                {r.optedOut ? "opted out" : r.email ?? "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-10 text-center text-ink-soft">
                No prospects match. Run discovery, or clear filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: (string | [string, string])[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-ink-soft">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="rounded-[var(--radius-base)] border border-line bg-paper px-2 py-1.5"
      >
        <option value="">Any</option>
        {options.map((o) => {
          const [val, lbl] = Array.isArray(o) ? o : [o, o];
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
    </label>
  );
}
