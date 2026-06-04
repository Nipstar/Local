import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/config";
import { getClaimPrefill } from "@/lib/claims";
import { ConfirmForm } from "@/components/ConfirmForm";

export const metadata: Metadata = {
  title: "Confirm your details",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const prefill = await getClaimPrefill(token);

  if (!prefill) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center sm:px-8">
        <p className="font-data text-xs uppercase tracking-widest text-green">Confirm</p>
        <h1 className="mt-3 text-4xl text-ink">This link isn&apos;t valid.</h1>
        <p className="mt-4 text-ink-soft">
          It may have expired or already been used. Find your business and claim
          it instead.
        </p>
        <Link href="/" className="link-underline mt-6 inline-block text-green">
          ← Back to {SITE.name}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <p className="font-data text-xs uppercase tracking-widest text-green">
        For {prefill.name}
      </p>
      <h1 className="mt-3 text-5xl leading-[0.95] text-ink">Confirm your details.</h1>
      <p className="mt-4 text-lg text-ink-soft">
        We&apos;ve pre-filled what we have. Edit anything, and on confirm your
        listing goes live as <strong>your own content</strong> — replacing the
        live Google data.
      </p>

      {prefill.googleSource && (
        <p className="font-data mt-4 rounded-[var(--radius-base)] border border-line bg-paper-2 px-4 py-3 text-xs text-ink-soft">
          Some fields seeded from Google · {prefill.googleSource.attribution}
        </p>
      )}

      {prefill.alreadyVerified && (
        <p className="font-data mt-4 text-sm text-amber">
          This listing was already confirmed — submitting will update it.
        </p>
      )}

      <div className="mt-10">
        <ConfirmForm prefill={prefill} />
      </div>
    </div>
  );
}
