import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/config";
import { optOut } from "@/lib/outreach";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One-click unsubscribe (PECR-friendly). Opts the contact out on visit. */
export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  const ok = await optOut(contactId).catch(() => false);

  return (
    <div className="mx-auto max-w-xl px-5 py-28 text-center sm:px-8">
      <p className="font-data text-xs uppercase tracking-widest text-green">{SITE.name}</p>
      <h1 className="mt-3 text-4xl text-ink">
        {ok ? "You're unsubscribed." : "We couldn't find that subscription."}
      </h1>
      <p className="mt-4 text-ink-soft">
        {ok
          ? "You won't receive further emails about this listing."
          : "The link may be invalid or you may already be unsubscribed."}
      </p>
      <Link href="/" className="link-underline mt-6 inline-block text-green">
        ← Back to {SITE.name}
      </Link>
    </div>
  );
}
