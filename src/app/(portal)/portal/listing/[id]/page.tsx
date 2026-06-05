import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { businesses, listingContent, subscriptions } from "@/db/schema";
import { userOwnsBusiness } from "@/lib/portal";
import { getEngagement, listEnquiries } from "@/lib/engagement";
import { gbpLive, isConnected } from "@/lib/integrations/gbp";
import { Badge } from "@/components/Badge";
import {
  updateListingAction,
  uploadPhotoAction,
  startUpgradeAction,
  billingPortalAction,
  importReviewsAction,
} from "../../actions";

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ListingEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { id } = await params;
  const { upgraded } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect(`/portal/login?callbackUrl=/portal/listing/${id}`);
  if (!(await userOwnsBusiness(session.user.id, id))) redirect("/portal");

  const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
  if (!biz) notFound();
  const [c] = await db.select().from(listingContent).where(eq(listingContent.businessId, id)).limit(1);
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, id)).limit(1);
  const photos = Array.isArray(c?.photos) ? (c!.photos as string[]) : [];
  const isPremium = biz.status === "premium";
  const [engagement, enquiries] = await Promise.all([
    getEngagement(id),
    isPremium ? listEnquiries(id, 10) : Promise.resolve([]),
  ]);
  const gbpConfigured = gbpLive();
  const gbpConnected = gbpConfigured ? await isConnected(session.user.id) : false;

  return (
    <div>
      <Link href="/portal" className="font-data text-xs uppercase tracking-wide text-green hover:text-green-lite">
        ← Dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl text-ink">{c?.displayName ?? biz.name}</h1>
          <p className="font-data mt-2 text-xs uppercase tracking-wide text-ink-soft">
            {biz.status}
            {sub?.tier ? ` · ${sub.tier}` : ""}
          </p>
        </div>
        <Link href={`/business/${biz.slug}`} className="font-data text-xs uppercase tracking-wide text-ink-soft hover:text-green">
          View public listing →
        </Link>
      </div>

      {upgraded && (
        <p className="mt-6 rounded-[var(--radius-base)] bg-green px-5 py-3 text-paper">
          🎉 You&apos;re {isPremium ? "Premium" : "upgraded"}. Your listing now shows the
          full-bleed editorial card.
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Editor */}
        <form action={updateListingAction} className="space-y-4">
          <input type="hidden" name="businessId" value={biz.id} />
          <Row>
            <Input name="displayName" label="Business name" defaultValue={c?.displayName ?? biz.name} />
            <Input name="tagline" label="Tagline" defaultValue={c?.tagline ?? ""} />
          </Row>
          <Area name="description" label="Description" defaultValue={c?.description ?? ""} />
          <Row>
            <Input name="phone" label="Phone" defaultValue={c?.phone ?? ""} />
            <Input name="email" label="Email" type="email" defaultValue={c?.email ?? ""} />
          </Row>
          <Row>
            <Input name="website" label="Website" defaultValue={c?.website ?? ""} />
            <Input name="priceBand" label="Price band" defaultValue={c?.priceBand ?? ""} placeholder="££" />
          </Row>
          <Row>
            <Input name="address" label="Address" defaultValue={c?.address ?? ""} />
            <Input name="postcode" label="Postcode" defaultValue={c?.postcode ?? ""} />
          </Row>
          <Input
            name="services"
            label="Services (comma-separated)"
            defaultValue={(c?.services ?? []).join(", ")}
          />
          <button className="rounded-[var(--radius-base)] bg-green px-6 py-3 font-medium text-paper">
            Save changes
          </button>
        </form>

        {/* Sidebar: analytics, photos, plan, reviews, enquiries */}
        <aside className="space-y-8">
          <Panel title="Analytics">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="font-data text-xs uppercase tracking-wide text-ink-soft">Views</dt>
                <dd className="text-2xl text-ink">{engagement.views}</dd>
              </div>
              <div>
                <dt className="font-data text-xs uppercase tracking-wide text-ink-soft">Enquiries</dt>
                <dd className="text-2xl text-ink">{engagement.enquiries}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Photos">
            {photos.length > 0 ? (
              <ul className="mb-3 space-y-1">
                {photos.map((p) => (
                  <li key={p} className="font-data truncate text-xs text-ink-soft">{p}</li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-ink-soft">No photos yet.</p>
            )}
            <form action={uploadPhotoAction} className="space-y-2">
              <input type="hidden" name="businessId" value={biz.id} />
              <input
                type="file"
                name="photo"
                accept="image/*"
                className="font-data block w-full text-xs"
              />
              <button className="w-full rounded-[var(--radius-base)] border border-line px-3 py-2 text-sm hover:bg-paper-2">
                Upload photo
              </button>
            </form>
            {!isPremium && (
              <p className="font-data mt-2 text-xs text-ink-soft">
                Galleries shine on Premium.
              </p>
            )}
          </Panel>

          <Panel title="Plan">
            {isPremium ? (
              <>
                <div className="mb-3">
                  <Badge variant="premium">Premium</Badge>
                </div>
                <form action={billingPortalAction}>
                  <input type="hidden" name="businessId" value={biz.id} />
                  <button className="w-full rounded-[var(--radius-base)] border border-line px-3 py-2 text-sm hover:bg-paper-2">
                    Manage billing →
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-ink-soft">
                  Go Premium for full-bleed photography, a gallery and the green
                  Verified badge.
                </p>
                <form action={startUpgradeAction}>
                  <input type="hidden" name="businessId" value={biz.id} />
                  <input type="hidden" name="tier" value="premium" />
                  <button className="w-full rounded-[var(--radius-base)] bg-amber px-4 py-2.5 font-medium text-paper">
                    Upgrade to Premium →
                  </button>
                </form>
              </>
            )}
          </Panel>

          {isPremium && (
            <Panel title="Google reviews">
              {gbpConfigured && !gbpConnected ? (
                <>
                  <p className="mb-3 text-sm text-ink-soft">
                    Connect your Google account to import your reviews (shown with
                    attribution).
                  </p>
                  <a
                    href={`/api/gbp/connect?businessId=${biz.id}`}
                    className="block w-full rounded-[var(--radius-base)] bg-green px-3 py-2 text-center text-sm text-paper"
                  >
                    Connect Google
                  </a>
                </>
              ) : (
                <>
                  <p className="mb-3 text-sm text-ink-soft">
                    {gbpConnected ? "Google connected. " : ""}Import your reviews
                    (shown with attribution).
                  </p>
                  <form action={importReviewsAction}>
                    <input type="hidden" name="businessId" value={biz.id} />
                    <button className="w-full rounded-[var(--radius-base)] border border-line px-3 py-2 text-sm hover:bg-paper-2">
                      Import Google reviews
                    </button>
                  </form>
                </>
              )}
            </Panel>
          )}

          {isPremium && (
            <Panel title="Recent enquiries">
              {enquiries.length === 0 ? (
                <p className="text-sm text-ink-soft">No enquiries yet.</p>
              ) : (
                <ul className="space-y-3">
                  {enquiries.map((e) => (
                    <li key={e.id} className="border-b border-line pb-2 text-sm last:border-0">
                      <p className="font-data text-xs text-ink-soft">
                        {e.createdAt?.toLocaleDateString("en-GB")} · {e.email ?? "—"}
                      </p>
                      {e.message && <p className="mt-1 text-ink">{e.message}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-base)] border border-line bg-paper p-5">
      <h2 className="font-data mb-4 text-xs uppercase tracking-widest text-green">{title}</h2>
      {children}
    </section>
  );
}
function Input({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-data text-xs uppercase tracking-wide text-ink-soft">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2 text-ink"
      />
    </label>
  );
}
function Area({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="font-data text-xs uppercase tracking-wide text-ink-soft">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={4}
        className="mt-1 w-full rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2 text-ink"
      />
    </label>
  );
}
