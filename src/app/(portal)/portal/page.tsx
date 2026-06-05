import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getManagedBusinesses } from "@/lib/portal";
import { Badge } from "@/components/Badge";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PortalDashboard({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/portal/login");
  const { claim } = await searchParams;
  const businesses = await getManagedBusinesses(session.user.id);

  return (
    <div>
      <p className="font-data text-xs uppercase tracking-widest text-green">
        Signed in as {session.user.email}
      </p>
      <h1 className="mt-3 text-4xl text-ink">Your listings</h1>

      {claim === "pending" && (
        <p className="mt-6 rounded-[var(--radius-base)] border border-line bg-paper-2 px-5 py-3 text-sm text-ink-soft">
          Thanks — your claim is <strong>pending review</strong>. We confirm
          ownership before handing over a listing; you&apos;ll be able to edit it
          once it&apos;s approved.
        </p>
      )}

      {businesses.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-base)] border border-line bg-paper-2 p-8">
          <p className="text-ink-soft">
            You don&apos;t manage any listings yet. Find your business in the
            directory and use <strong>“Is this your business?”</strong> to claim
            it, or open a confirm link we sent you.
          </p>
          <Link href="/" className="link-underline mt-4 inline-block text-green">
            Browse the directory →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {businesses.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-lg text-ink">{b.displayName ?? b.name}</p>
                <p className="font-data text-xs uppercase tracking-wide text-ink-soft">
                  {b.status}
                  {b.tier ? ` · ${b.tier}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {b.status === "premium" && <Badge variant="premium">Premium</Badge>}
                <Link
                  href={`/portal/listing/${b.id}`}
                  className="rounded-[var(--radius-base)] border border-ink px-4 py-2 text-sm text-ink hover:bg-ink hover:text-paper"
                >
                  Edit →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
