import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Wordmark } from "@/components/Wordmark";

export const metadata = { robots: { index: false } };

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-paper-2">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="font-data text-xs uppercase tracking-widest text-green">portal</span>
          </div>
          <nav className="font-data flex items-center gap-5 text-xs uppercase tracking-wide text-ink-soft">
            <Link href="/" className="hover:text-green">View site →</Link>
            {session?.user && (
              <>
                <Link href="/portal" className="hover:text-green">Dashboard</Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button className="uppercase tracking-wide hover:text-green">Sign out</button>
                </form>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8">{children}</main>
    </div>
  );
}
