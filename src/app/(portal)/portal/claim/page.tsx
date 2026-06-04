import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { claimBusinessForUser } from "@/lib/portal";
import { SITE } from "@/lib/config";

export const metadata: Metadata = { title: "Claim your business", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Entry from the public "Is this your business?" CTA (/portal/claim?b=slug).
 * If signed in, claims and routes to the editor; otherwise sends to login with
 * a callback back here.
 */
export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const { b } = await searchParams;
  const session = await auth();

  if (!session?.user?.id) {
    const callback = b ? `/portal/claim?b=${encodeURIComponent(b)}` : "/portal";
    redirect(`/portal/login?callbackUrl=${encodeURIComponent(callback)}`);
  }

  if (b) {
    const res = await claimBusinessForUser(session.user.id, b);
    if (res.ok && res.businessId) redirect(`/portal/listing/${res.businessId}`);
  }

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-3xl text-ink">Claim a business</h1>
      <p className="mt-3 text-ink-soft">
        Find your business in the {SITE.name} directory and use the “Is this your
        business?” button to claim it.
      </p>
      <Link href="/" className="link-underline mt-6 inline-block text-green">
        Browse the directory →
      </Link>
    </div>
  );
}
