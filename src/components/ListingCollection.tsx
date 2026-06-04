import type { ListingView } from "@/lib/queries";
import { PremiumCard } from "./PremiumCard";
import { ListingRow } from "./ListingRow";

/**
 * Renders a result set the way the mockup does: premium listings as full-bleed
 * editorial cards up top, the rest as compact rows below. The first premium
 * card is featured (larger). The staggered reveal runs once on load.
 */
export function ListingCollection({ listings }: { listings: ListingView[] }) {
  if (listings.length === 0) {
    return (
      <p className="border-t border-line py-16 text-center text-ink-soft">
        No listings here yet — this corner of the directory is still being
        written up.
      </p>
    );
  }

  const premium = listings.filter((l) => l.isPremium);
  const standard = listings.filter((l) => !l.isPremium);

  return (
    <div className="space-y-12">
      {premium.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2">
          {premium.map((l, i) => (
            <div
              key={l.slug}
              className="reveal"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <PremiumCard listing={l} feature={i === 0 && premium.length > 1} />
            </div>
          ))}
        </div>
      )}

      {standard.length > 0 && (
        <div className="border-t border-line">
          {standard.map((l, i) => (
            <div
              key={l.slug}
              className="reveal"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <ListingRow listing={l} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
