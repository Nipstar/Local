import Link from "next/link";
import { SITE } from "@/lib/config";
import { signOut } from "@/auth";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata = { robots: { index: false } };

/**
 * Admin shell. Gated by requireAdmin() — an ADMIN_EMAILS allowlist over the
 * shared magic-link auth. Open in dev when no allowlist is configured.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-paper-2">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/admin" className="font-display text-lg text-ink">
            {SITE.name} <span className="font-data text-xs uppercase tracking-widest text-green">admin</span>
          </Link>
          <nav className="font-data flex items-center gap-5 text-xs uppercase tracking-wide text-ink-soft">
            <Link href="/admin" className="hover:text-green">Prospects</Link>
            <Link href="/" className="hover:text-green">View site →</Link>
            {session?.user && (
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="uppercase tracking-wide hover:text-green">Sign out</button>
              </form>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">{children}</main>
    </div>
  );
}
