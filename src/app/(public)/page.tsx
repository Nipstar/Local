import Link from "next/link";
import { SITE } from "@/lib/config";
import {
  allLocations,
  allCategories,
  topCategoriesWithCounts,
} from "@/lib/queries";
import { SearchBar } from "@/components/SearchBar";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { sql } from "drizzle-orm";

// ISR — re-render hourly; cheap and keeps counts fresh.
export const revalidate = 3600;

const POPULAR = [
  ["Plumbers", "/plumbers"],
  ["Electricians", "/electricians"],
  ["Cafés", "/cafes"],
  ["Florists", "/florists"],
  ["Roofers", "/roofers"],
  ["Farm shops", "/farm-shops"],
];

export default async function HomePage() {
  const [cats, towns, allCats, totalRow] = await Promise.all([
    topCategoriesWithCounts(),
    allLocations(),
    allCategories(),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(businesses)
      .where(sql`${businesses.status} <> 'suppressed'`),
  ]);
  const total = totalRow[0]?.n ?? 0;

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-16 sm:px-8 sm:pt-24">
        <p className="font-data reveal flex items-center gap-2 text-sm uppercase tracking-wide text-green">
          <BookGlyph /> The {SITE.county} directory ·{" "}
          {total.toLocaleString("en-GB")} businesses listed
        </p>
        <h1
          className="reveal mt-6 max-w-4xl text-6xl leading-[0.95] text-ink sm:text-8xl"
          style={{ animationDelay: "60ms" }}
        >
          Find someone good, nearby.
        </h1>
        <p
          className="reveal mt-6 max-w-xl text-lg text-ink-soft"
          style={{ animationDelay: "120ms" }}
        >
          {SITE.description}
        </p>

        <div
          className="reveal mt-10 max-w-3xl"
          style={{ animationDelay: "180ms" }}
        >
          <SearchBar
            towns={towns.map((t) => ({ slug: t.slug, name: t.name }))}
            categories={allCats.map((c) => ({ slug: c.slug, name: c.name }))}
          />
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="font-data uppercase tracking-wide text-ink-soft">
              Popular
            </span>
            {POPULAR.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="link-underline text-green hover:text-green-lite"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Browse by category ─── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="font-data text-xs uppercase tracking-widest text-green">
          By trade
        </p>
        <h2 className="mt-3 text-5xl text-ink">Browse by category</h2>

        <div className="mt-10 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="group flex flex-col border-b border-r border-line p-7 transition-colors hover:bg-paper-2"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-3xl text-ink">{c.name}</h3>
                <span className="font-data text-sm text-ink-soft">
                  {c.count.toLocaleString("en-GB")}
                </span>
              </div>
              {c.blurb && (
                <p className="mt-3 text-sm text-ink-soft">{c.blurb}</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Owner CTA band ─── */}
      <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
        <div className="rounded-[var(--radius-base)] bg-green px-8 py-12 text-paper sm:px-12 sm:py-14">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <p className="font-data text-xs uppercase tracking-widest text-paper/70">
                For business owners
              </p>
              <h2 className="mt-4 text-5xl text-paper">
                Run a business in {SITE.county}?
              </h2>
              <p className="mt-4 max-w-xl text-paper/85">
                Claim your free listing, or go Premium for full-bleed
                photography, a gallery and the green Verified badge customers
                look for.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/portal/claim"
                className="rounded-[var(--radius-base)] bg-amber px-6 py-3 text-center font-medium text-paper transition-opacity hover:opacity-90"
              >
                Claim your listing →
              </Link>
              <Link
                href="/premium"
                className="rounded-[var(--radius-base)] border border-paper/40 px-6 py-3 text-center text-paper transition-colors hover:bg-paper/10"
              >
                See premium →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function BookGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 5C8 3.5 5 3.5 3 4v11c2-.5 5-.5 7 1 2-1.5 5-1.5 7-1V4c-2-.5-5-.5-7 1zM10 5v12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
