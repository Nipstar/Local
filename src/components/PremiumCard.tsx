import Link from "next/link";
import type { ListingView } from "@/lib/queries";
import { Badge, LeafGlyph, Rating, VerifiedTick } from "./Badge";

/**
 * Premium listing — a full-bleed editorial card with a photography slot,
 * longer copy and room for a gallery. Visibly a different class of object to
 * <ListingRow> (spec §2). `feature` makes the lead card span larger.
 */
export function PremiumCard({
  listing,
  feature = false,
}: {
  listing: ListingView;
  feature?: boolean;
}) {
  const title = listing.displayName ?? listing.name;
  const photo = listing.photos?.[0];

  return (
    <Link
      href={`/business/${listing.slug}`}
      className={`row-lift group block overflow-hidden rounded-[var(--radius-base)] border border-line bg-paper ${
        feature ? "sm:row-span-2" : ""
      }`}
    >
      {/* Photography slot — dashed placeholder mirrors the mockup's "drop a photo" */}
      <div
        className={`relative flex items-center justify-center border-b border-line bg-paper-2 ${
          feature ? "aspect-[4/3]" : "aspect-[16/9]"
        }`}
        style={
          photo ? { backgroundImage: `url(${photo})`, backgroundSize: "cover" } : undefined
        }
      >
        {!photo && (
          <span className="font-data text-sm text-ink-soft/70">
            {title} — drop a photo
          </span>
        )}
        <div className="absolute left-3 top-3">
          <Badge variant="premium" icon={<LeafGlyph />}>
            Premium
          </Badge>
        </div>
        {listing.isVerified && (
          <div className="absolute right-3 top-3">
            <Badge variant="verified" icon={<VerifiedTick />}>
              Verified
            </Badge>
          </div>
        )}
      </div>

      <div className="p-5">
        {(listing.category || listing.location) && (
          <p className="font-data text-xs uppercase tracking-wide text-green">
            {[listing.tagline ?? listing.category?.name, listing.location?.name]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <h3
          className={`mt-2 text-ink ${feature ? "text-3xl" : "text-2xl"} leading-tight`}
        >
          {title}
        </h3>
        {listing.description && (
          <p
            className={`mt-2 text-ink-soft ${feature ? "" : "line-clamp-2"} text-[15px] leading-relaxed`}
          >
            {listing.description}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <Rating value={listing.rating} reviews={listing.reviewCount} />
          {listing.priceBand && (
            <span className="font-data text-sm text-ink-soft">
              {listing.priceBand}
              {listing.postcode ? ` · ${listing.postcode}` : ""}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
