import Link from "next/link";
import { Wordmark } from "./Wordmark";

const NAV = [
  { label: "Towns", href: "/towns" },
  { label: "Categories", href: "/categories" },
  { label: "Verified", href: "/verified" },
  { label: "Journal", href: "/journal" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
        <Wordmark />

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="link-underline text-[15px] text-ink hover:text-green"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/portal"
            className="hidden text-[15px] text-ink hover:text-green sm:inline"
          >
            Sign in
          </Link>
          <Link
            href="/portal/claim"
            className="rounded-[var(--radius-base)] border border-ink px-4 py-2 text-[15px] text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Add your business
          </Link>
        </div>
      </div>
    </header>
  );
}
