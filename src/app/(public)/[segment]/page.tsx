import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE } from "@/lib/config";
import {
  allCategories,
  allLocations,
  getCategoryBySlug,
  getLocationBySlug,
  listByCategory,
  listByLocation,
} from "@/lib/queries";
import { DirectoryHeader } from "@/components/DirectoryHeader";
import { ListingCollection } from "@/components/ListingCollection";
import { breadcrumbJsonLd, JsonLd } from "@/lib/jsonld";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { params: Promise<{ segment: string }> };

/** A single dynamic segment that is either a town or a category. */
async function resolve(segment: string) {
  const town = await getLocationBySlug(segment);
  if (town) return { kind: "town" as const, town };
  const category = await getCategoryBySlug(segment);
  if (category) return { kind: "category" as const, category };
  return null;
}

export async function generateStaticParams() {
  const [towns, cats] = await Promise.all([allLocations(), allCategories()]);
  return [...towns, ...cats].map((x) => ({ segment: x.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { segment } = await params;
  const r = await resolve(segment);
  if (!r) return {};
  const canonical = `${SITE.url}/${segment}`;
  if (r.kind === "town") {
    const title = `Businesses in ${r.town.name}`;
    return {
      title,
      description: `Trades, shops and kitchens in ${r.town.name}, ${SITE.county} — checked and reviewed on ${SITE.name}.`,
      alternates: { canonical },
      openGraph: { title, url: canonical },
    };
  }
  const title = `${r.category.name} in ${SITE.county}`;
  return {
    title,
    description: `Find ${r.category.name.toLowerCase()} across ${SITE.county} on ${SITE.name}.`,
    alternates: { canonical },
    openGraph: { title, url: canonical },
  };
}

export default async function SegmentPage({ params }: Params) {
  const { segment } = await params;
  const r = await resolve(segment);
  if (!r) notFound();

  if (r.kind === "town") {
    const listings = await listByLocation(r.town.slug);
    return (
      <>
        <JsonLd
          data={breadcrumbJsonLd([
            { name: "Towns", url: "/towns" },
            { name: r.town.name, url: `/${r.town.slug}` },
          ])}
        />
        <DirectoryHeader
          eyebrow={`${SITE.county} town`}
          title={`Good in ${r.town.name}.`}
          intro={`Everyone worth knowing in ${r.town.name} — trades, kitchens and shops, written up and checked.`}
          count={listings.length}
          crumbs={[{ name: "Towns", href: "/towns" }, { name: r.town.name, href: `/${r.town.slug}` }]}
        />
        <div className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
          <ListingCollection listings={listings} />
        </div>
      </>
    );
  }

  const listings = await listByCategory(r.category.slug);
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Categories", url: "/categories" },
          { name: r.category.name, url: `/${r.category.slug}` },
        ])}
      />
      <DirectoryHeader
        eyebrow="By trade"
        title={r.category.name}
        intro={r.category.blurb ?? `The best ${r.category.name.toLowerCase()} in ${SITE.county}.`}
        count={listings.length}
        crumbs={[
          { name: "Categories", href: "/categories" },
          { name: r.category.name, href: `/${r.category.slug}` },
        ]}
      />
      <div className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
        <ListingCollection listings={listings} />
      </div>
    </>
  );
}
