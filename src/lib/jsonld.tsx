/**
 * Structured data builders. LocalBusiness on every business page, BreadcrumbList
 * on category/town pages (spec §1). Rendered into a <script type="application/ld+json">.
 */
import { SITE } from "./config";
import type { ListingView } from "./queries";

export function localBusinessJsonLd(listing: ListingView) {
  const name = listing.displayName ?? listing.name;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    description: listing.description ?? undefined,
    url: `${SITE.url}/business/${listing.slug}`,
    address: listing.location
      ? {
          "@type": "PostalAddress",
          addressLocality: listing.location.name,
          addressRegion: SITE.county,
          postalCode: listing.postcode ?? undefined,
          addressCountry: "GB",
        }
      : undefined,
    aggregateRating:
      listing.rating != null
        ? {
            "@type": "AggregateRating",
            ratingValue: listing.rating,
            reviewCount: listing.reviewCount ?? undefined,
          }
        : undefined,
  };
}

export function breadcrumbJsonLd(crumbs: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE.url}${c.url}`,
    })),
  };
}

/** Inline <script> JSON-LD. Use the returned element in a page. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe; no user HTML injected.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
