import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE } from "@/lib/config";
import {
  allCategories,
  allLocations,
  getCategoryBySlug,
  getLocationBySlug,
  listByLocationAndCategory,
} from "@/lib/queries";
import { DirectoryHeader } from "@/components/DirectoryHeader";
import { ListingCollection } from "@/components/ListingCollection";
import { breadcrumbJsonLd, JsonLd } from "@/lib/jsonld";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { params: Promise<{ segment: string; sub: string }> };

/** Canonical order is /[town]/[category]; fall back to /[category]/[town]. */
async function resolve(segment: string, sub: string) {
  const town = await getLocationBySlug(segment);
  const category = await getCategoryBySlug(sub);
  if (town && category) return { town, category };
  const town2 = await getLocationBySlug(sub);
  const category2 = await getCategoryBySlug(segment);
  if (town2 && category2) return { town: town2, category: category2 };
  return null;
}

export async function generateStaticParams() {
  const [towns, cats] = await Promise.all([allLocations(), allCategories()]);
  const topCats = cats.filter((c) => !c.parentId);
  return towns.flatMap((t) =>
    topCats.map((c) => ({ segment: t.slug, sub: c.slug })),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { segment, sub } = await params;
  const r = await resolve(segment, sub);
  if (!r) return {};
  const title = `${r.category.name} in ${r.town.name}`;
  const canonical = `${SITE.url}/${r.town.slug}/${r.category.slug}`;
  return {
    title,
    description: `${r.category.name} in ${r.town.name}, ${SITE.county} — checked and reviewed on ${SITE.name}.`,
    alternates: { canonical },
    openGraph: { title, url: canonical },
  };
}

export default async function TownCategoryPage({ params }: Params) {
  const { segment, sub } = await params;
  const r = await resolve(segment, sub);
  if (!r) notFound();

  const listings = await listByLocationAndCategory(r.town.slug, r.category.slug);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: r.town.name, url: `/${r.town.slug}` },
          { name: r.category.name, url: `/${r.town.slug}/${r.category.slug}` },
        ])}
      />
      <DirectoryHeader
        eyebrow={`${r.category.name} · ${r.town.name}`}
        title={`${r.category.name} in ${r.town.name}.`}
        intro={`The ${r.category.name.toLowerCase()} worth calling in ${r.town.name} — checked and written up.`}
        count={listings.length}
        crumbs={[
          { name: r.town.name, href: `/${r.town.slug}` },
          { name: r.category.name, href: `/${r.town.slug}/${r.category.slug}` },
        ]}
      />
      <div className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
        <ListingCollection listings={listings} />
      </div>
    </>
  );
}
