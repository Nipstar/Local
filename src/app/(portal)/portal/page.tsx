import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Owner portal",
  robots: { index: false },
};

/** Placeholder — the self-serve owner portal lands in Phase 4. */
export default function PortalPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-24 text-center sm:px-8">
      <p className="font-data text-xs uppercase tracking-widest text-green">
        For business owners
      </p>
      <h1 className="mt-3 text-4xl text-ink">Owner portal</h1>
      <p className="mt-4 text-lg text-ink-soft">
        Claim, edit and upgrade your listing. Magic-link sign-in, the listing
        editor and Stripe billing arrive in Phase 4.
      </p>
      <Link
        href="/"
        className="link-underline mt-8 inline-block text-green"
      >
        ← Back to the directory
      </Link>
    </div>
  );
}
