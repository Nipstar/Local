import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { SITE } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ check?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (session?.user) redirect(sp.callbackUrl ?? "/portal");

  return (
    <div className="mx-auto max-w-md py-16">
      <p className="font-data text-xs uppercase tracking-widest text-green">
        {SITE.name} portal
      </p>
      <h1 className="mt-3 text-4xl text-ink">Sign in.</h1>

      {sp.check ? (
        <p className="mt-6 rounded-[var(--radius-base)] border border-line bg-paper-2 p-5 text-ink-soft">
          Check your email for a magic link. In dev (no Brevo key) the link is
          printed to the server console.
        </p>
      ) : (
        <form
          action={async (formData) => {
            "use server";
            const email = String(formData.get("email") ?? "").trim();
            if (!email) return;
            await signIn("brevo", {
              email,
              redirectTo: sp.callbackUrl ?? "/portal",
            });
          }}
          className="mt-8 space-y-4"
        >
          <label className="block">
            <span className="font-data text-xs uppercase tracking-wide text-ink-soft">Email</span>
            <input
              name="email"
              type="email"
              required
              placeholder="you@business.co.uk"
              className="mt-1 w-full rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2.5 text-ink"
            />
          </label>
          <button className="w-full rounded-[var(--radius-base)] bg-amber px-5 py-3 font-medium text-paper">
            Email me a magic link →
          </button>
          <p className="font-data text-xs text-ink-soft">
            No passwords. We&apos;ll email you a one-time sign-in link.
          </p>
        </form>
      )}
    </div>
  );
}
