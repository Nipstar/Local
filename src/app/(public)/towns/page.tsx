import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/config";
import { allLocations } from "@/lib/queries";
import { DirectoryHeader } from "@/components/DirectoryHeader";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Towns",
  description: `Browse ${SITE.county} by town on ${SITE.name}.`,
  alternates: { canonical: `${SITE.url}/towns` },
};

export default async function TownsPage() {
  const towns = await allLocations();
  return (
    <>
      <DirectoryHeader
        eyebrow={`${SITE.county}`}
        title="Every town."
        intro={`Pick a town to see the trades, shops and kitchens worth knowing nearby.`}
        count={towns.length}
      />
      <div className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
        <div className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
          {towns.map((t) => (
            <Link
              key={t.slug}
              href={`/${t.slug}`}
              className="border-b border-r border-line p-6 text-2xl text-ink transition-colors hover:bg-paper-2 hover:text-green"
            >
              {t.name}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
