import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProspectDetail } from "@/lib/admin-queries";
import { getActivity } from "@/lib/activity";
import { listPendingClaims } from "@/lib/portal";
import { ConfirmLinkButton } from "@/components/admin/ConfirmLinkButton";
import {
  setStatusAction,
  saveContactAction,
  reenrichAction,
  approveClaimAction,
} from "../../actions";

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUSES = ["prospect", "contacted", "confirmed", "claimed", "premium", "suppressed"];

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const b = await getProspectDetail(id);
  if (!b) notFound();
  const activity = await getActivity(id);
  const pendingClaims = await listPendingClaims(id);
  const tech = b.enrichment?.tech as Record<string, unknown> | null;

  return (
    <div>
      <Link href="/admin" className="font-data text-xs uppercase tracking-wide text-green hover:text-green-lite">
        ← Prospects
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl text-ink">{b.name}</h1>
          <p className="font-data mt-2 text-xs uppercase tracking-wide text-ink-soft">
            {[b.category, b.town].filter(Boolean).join(" · ") || "—"} · {b.status}
          </p>
        </div>
        <Link
          href={`/business/${b.slug}`}
          className="font-data text-xs uppercase tracking-wide text-ink-soft hover:text-green"
        >
          View public listing →
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          {/* Enrichment */}
          <Panel title="Enrichment">
            {b.enrichment?.checkedAt ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Score">{b.enrichment.score ?? "—"}</Field>
                <Field label="Has website">{String(b.enrichment.hasWebsite)}</Field>
                <Field label="Lead type">{b.enrichment.leadType?.join(", ") ?? "—"}</Field>
                <Field label="Builder/CMS">
                  {(tech?.builder as string) ?? (tech?.cms as string) ?? "—"}
                  {tech?.ghl ? " (GHL)" : ""}
                </Field>
                <Field label="Capture">
                  {[
                    ...((tech?.chat as string[]) ?? []),
                    ...((tech?.booking as string[]) ?? []),
                  ].join(", ") || "none"}
                </Field>
                <Field label="Pack rank">
                  {b.enrichment.packRank ? JSON.stringify(b.enrichment.packRank) : "—"}
                </Field>
              </dl>
            ) : (
              <p className="text-sm text-ink-soft">Not enriched yet.</p>
            )}
            <form action={reenrichAction} className="mt-4">
              <input type="hidden" name="businessId" value={b.id} />
              <button className="rounded-[var(--radius-base)] border border-line px-3 py-1.5 text-sm hover:bg-paper-2">
                Re-enrich
              </button>
            </form>
          </Panel>

          {/* Activity timeline */}
          <Panel title="Activity">
            {activity.length === 0 ? (
              <p className="text-sm text-ink-soft">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-baseline gap-3 text-sm">
                    <span className="font-data text-xs text-ink-soft">
                      {a.createdAt?.toLocaleString("en-GB")}
                    </span>
                    <span className="font-data rounded-[var(--radius-base)] bg-paper-2 px-2 py-0.5 text-xs text-green">
                      {a.type}
                    </span>
                    {a.payload != null && Object.keys(a.payload as object).length > 0 && (
                      <span className="text-ink-soft">{JSON.stringify(a.payload)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-8">
          {/* Status */}
          <Panel title="Status">
            <form action={setStatusAction} className="flex items-center gap-2">
              <input type="hidden" name="businessId" value={b.id} />
              <select
                name="status"
                defaultValue={b.status}
                className="font-data flex-1 rounded-[var(--radius-base)] border border-line bg-paper px-2 py-1.5 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button className="rounded-[var(--radius-base)] bg-green px-3 py-1.5 text-sm text-paper">
                Save
              </button>
            </form>
          </Panel>

          {/* Pending self-serve claims awaiting approval */}
          {pendingClaims.length > 0 && (
            <Panel title="Pending claims">
              <ul className="space-y-3">
                {pendingClaims.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-data truncate text-xs text-ink-soft">
                      {c.email ?? c.userId}
                    </span>
                    <form action={approveClaimAction}>
                      <input type="hidden" name="claimId" value={c.id} />
                      <input type="hidden" name="businessId" value={b.id} />
                      <button className="shrink-0 rounded-[var(--radius-base)] bg-green px-3 py-1.5 text-xs text-paper">
                        Approve
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* Confirm link */}
          <Panel title="Confirm-your-details link">
            <ConfirmLinkButton businessId={b.id} />
          </Panel>

          {/* Contact */}
          <Panel title="Outreach contact">
            <form action={saveContactAction} className="space-y-2 text-sm">
              <input type="hidden" name="businessId" value={b.id} />
              <input
                name="email"
                type="email"
                placeholder="owner@example.com"
                defaultValue={b.contact?.email ?? ""}
                className="w-full rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2"
              />
              <select
                name="entityType"
                defaultValue={b.contact?.entityType ?? "ltd"}
                className="font-data w-full rounded-[var(--radius-base)] border border-line bg-paper px-2 py-1.5 text-xs"
              >
                <option value="ltd">ltd</option>
                <option value="llp">llp</option>
                <option value="sole_trader">sole_trader</option>
                <option value="partnership">partnership</option>
              </select>
              <input
                name="consentBasis"
                placeholder="consent basis (sole traders)"
                defaultValue={b.contact?.consentBasis ?? ""}
                className="font-data w-full rounded-[var(--radius-base)] border border-line bg-paper px-3 py-1.5 text-xs"
              />
              <button className="w-full rounded-[var(--radius-base)] bg-green px-3 py-2 text-paper">
                Save contact
              </button>
              {b.contact?.optedOut && (
                <p className="font-data text-xs text-amber">Contact has opted out.</p>
              )}
            </form>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-base)] border border-line bg-paper p-5">
      <h2 className="font-data mb-4 text-xs uppercase tracking-widest text-green">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-data text-xs uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
