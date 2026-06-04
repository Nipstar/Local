import Link from "next/link";
import type { ListingView } from "@/lib/queries";
import { Badge, Rating, VerifiedTick } from "./Badge";

/**
 * Standard listing — a compact, breathable row (logo, name, one-line, rating,
 * tags). Deliberately a lesser object than <PremiumCard>; that gap is the
 * upsell (spec §2).
 */
export function ListingRow({ listing }: { listing: ListingView }) {
  const title = listing.displayName ?? listing.name;
  return (
    <Link
      href={`/business/${listing.slug}`}
      className="row-lift group flex items-center gap-5 border-b border-line bg-paper px-1 py-5"
    >
      {/* Monogram stand-in for a logo */}
      <div className="font-display grid size-12 shrink-0 place-items-center rounded-[var(--radius-base)] border border-line bg-paper-2 text-lg text-green">
        {title.charAt(0)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <h3 className="truncate text-[17px] font-medium text-ink">{title}</h3>
          {listing.isVerified && (
            <Badge variant="verified" icon={<VerifiedTick />}>
              Verified
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-ink-soft">
          {listing.tagline ?? listing.category?.name}
          {listing.location ? ` · ${listing.location.name}` : ""}
        </p>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <Rating value={listing.rating} reviews={listing.reviewCount} />
        {listing.priceBand && (
          <span className="font-data text-xs text-ink-soft">{listing.priceBand}</span>
        )}
      </div>
    </Link>
  );
}
