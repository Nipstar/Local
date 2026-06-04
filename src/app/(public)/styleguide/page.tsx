import type { Metadata } from "next";
import type { ListingView } from "@/lib/queries";
import { PremiumCard } from "@/components/PremiumCard";
import { ListingRow } from "@/components/ListingRow";
import { Badge, LeafGlyph, Rating, VerifiedTick } from "@/components/Badge";

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false },
};

const SWATCHES: [string, string][] = [
  ["paper", "var(--paper)"],
  ["paper-2", "var(--paper-2)"],
  ["ink", "var(--ink)"],
  ["ink-soft", "var(--ink-soft)"],
  ["green", "var(--green)"],
  ["green-lite", "var(--green-lite)"],
  ["amber", "var(--amber)"],
  ["line", "var(--line)"],
];

const samplePremium: ListingView = {
  slug: "the-watercress-line-cafe",
  name: "The Watercress Line Café",
  displayName: "The Watercress Line Café",
  tagline: "Café & Kitchen",
  description:
    "A seasonal kitchen on the platform at Alresford, cooking with Hampshire growers and the watercress beds a mile up the road. Walk-ins welcome on weekdays; the terrace books out on steam weekends.",
  status: "premium",
  rating: 4.9,
  reviewCount: 214,
  priceBand: "££",
  postcode: "SO24 9JG",
  photos: null,
  category: { name: "Café & Kitchen", slug: "cafes" },
  location: { name: "Alresford", slug: "alresford" },
  isPremium: true,
  isVerified: true,
};

const sampleStandard: ListingView = {
  ...samplePremium,
  slug: "gauntlett-and-sons",
  name: "Gauntlett & Sons",
  displayName: "Gauntlett & Sons",
  tagline: "Plumbing & Heating",
  description: "Family heating engineers, Andover since 1987.",
  status: "claimed",
  rating: 4.8,
  reviewCount: 96,
  priceBand: null,
  postcode: null,
  category: { name: "Plumbing & Heating", slug: "plumbers" },
  location: { name: "Andover", slug: "andover" },
  isPremium: false,
  isVerified: true,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-12">
      <h2 className="font-data mb-8 text-xs uppercase tracking-widest text-green">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
      <p className="font-data text-xs uppercase tracking-widest text-green">
        Design system
      </p>
      <h1 className="mt-3 text-5xl text-ink">HantsLocal styleguide</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        The editorial-modern system from the build spec §2 — warm paper, deep
        ink, botanical green, and the premium-vs-standard listing gap that drives
        the upsell.
      </p>

      <Section title="Colour">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SWATCHES.map(([name, value]) => (
            <div key={name}>
              <div
                className="h-20 rounded-[var(--radius-base)] border border-line"
                style={{ background: value }}
              />
              <p className="font-data mt-2 text-xs text-ink-soft">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type scale">
        <div className="space-y-3">
          <p className="text-6xl text-ink">Find someone good.</p>
          <p className="text-4xl text-ink">Fraunces display, optical sizing</p>
          <p className="text-xl text-ink">
            Hanken Grotesk body — a curated directory of Hampshire&apos;s trades,
            shops and kitchens.
          </p>
          <p className="font-data text-sm text-ink-soft">
            JetBrains Mono · data, ratings, tags · 4.9 · SO24 9JG
          </p>
        </div>
      </Section>

      <Section title="Badges & rating">
        <div className="flex flex-wrap items-center gap-4">
          <Badge variant="premium" icon={<LeafGlyph />}>
            Premium
          </Badge>
          <Badge variant="verified" icon={<VerifiedTick />}>
            Verified
          </Badge>
          <Badge variant="neutral">Café</Badge>
          <Rating value={4.9} reviews={214} />
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <button className="rounded-[var(--radius-base)] bg-amber px-5 py-2.5 text-paper">
            Search →
          </button>
          <button className="rounded-[var(--radius-base)] border border-ink px-5 py-2.5 text-ink transition-colors hover:bg-ink hover:text-paper">
            Add your business
          </button>
          <button className="rounded-[var(--radius-base)] bg-green px-5 py-2.5 text-paper">
            Claim your listing →
          </button>
        </div>
      </Section>

      <Section title="Premium card vs standard row">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="max-w-md">
            <PremiumCard listing={samplePremium} />
          </div>
          <div>
            <ListingRow listing={sampleStandard} />
            <ListingRow listing={{ ...sampleStandard, slug: "x2", isVerified: false }} />
          </div>
        </div>
      </Section>
    </div>
  );
}
