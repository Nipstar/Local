import Link from "next/link";
import { SITE } from "@/lib/config";

export const metadata = { robots: { index: false } };

/**
 * Admin shell. NOTE: unauthenticated by design for now — Auth.js gating lands in
 * Phase 4. /admin is robots-disallowed in the meantime.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">{children}</main>
    </div>
  );
}
