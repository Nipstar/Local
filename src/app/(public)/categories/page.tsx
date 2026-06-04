import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/config";
import { topCategoriesWithCounts } from "@/lib/queries";
import { DirectoryHeader } from "@/components/DirectoryHeader";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Categories",
  description: `Browse ${SITE.county} businesses by trade on ${SITE.name}.`,
  alternates: { canonical: `${SITE.url}/categories` },
};

export default async function CategoriesPage() {
  const cats = await topCategoriesWithCounts();
  return (
    <>
      <DirectoryHeader
        eyebrow="By trade"
        title="Browse by category."
        intro="Six broad families of trade, each checked and written up like a local publication."
      />
      <div className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
        <div className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="flex flex-col border-b border-r border-line p-7 transition-colors hover:bg-paper-2"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-3xl text-ink">{c.name}</h2>
                <span className="font-data text-sm text-ink-soft">
                  {c.count.toLocaleString("en-GB")}
                </span>
              </div>
              {c.blurb && <p className="mt-3 text-sm text-ink-soft">{c.blurb}</p>}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
