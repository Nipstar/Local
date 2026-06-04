import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SITE } from "@/lib/config";
import { getBusinessDetail, allListingSlugs } from "@/lib/queries";
import { placeDetails, type PlaceDetails } from "@/lib/integrations/places";
import { getReviews } from "@/lib/reviews";
import { Badge, LeafGlyph, Rating, VerifiedTick } from "@/components/Badge";
import { breadcrumbJsonLd, localBusinessJsonLd, JsonLd } from "@/lib/jsonld";
import { ViewBeacon } from "@/components/ViewBeacon";
import { EnquiryForm } from "@/components/EnquiryForm";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await allListingSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBusinessDetail(slug);
  if (!b) return {};
  const name = b.displayName ?? b.name;
  const where = b.location ? ` in ${b.location.name}` : "";
  return {
    title: name,
    description: b.description ?? `${name}${where} — on ${SITE.name}.`,
    alternates: { canonical: `${SITE.url}/business/${b.slug}` },
    openGraph: { title: name, url: `${SITE.url}/business/${b.slug}` },
  };
}

export default async function BusinessPage({ params }: Params) {
  const { slug } = await params;
  const b = await getBusinessDetail(slug);
  if (!b) notFound();

  // Unclaimed prospect: live-fetch transient Google details (spec §0). Never
  // persisted; always shown with attribution. Mock mode covers no-key dev.
  let live: PlaceDetails | null = null;
  if (!b.isOwned) {
    try {
      live = await placeDetails(b.placeId);
    } catch {
      live = null; // graceful — render seed only
    }
  }

  // Premium owners can show imported reviews + a gallery.
  const reviewList = b.isPremium ? await getReviews(b.id) : [];
  const gallery = b.isPremium && b.photos ? b.photos : [];

  const name = b.displayName ?? b.name;
  const rating = b.isOwned ? b.rating : (live?.rating ?? null);
  const reviewCount = b.isOwned ? b.reviewCount : (live?.reviewCount ?? null);
  const phone = b.phone ?? (b.isOwned ? null : live?.phone) ?? null;
  const website = b.website ?? (b.isOwned ? null : live?.website) ?? null;
  const address = b.address ?? (b.isOwned ? null : live?.address) ?? null;
  const hours = (b.hours as string[] | null) ?? (b.isOwned ? null : live?.hours) ?? null;

  return (
    <article>
      <ViewBeacon businessId={b.id} />
      <JsonLd data={localBusinessJsonLd(b)} />
      <JsonLd
        data={breadcrumbJsonLd([
          ...(b.location ? [{ name: b.location.name, url: `/${b.location.slug}` }] : []),
          ...(b.category ? [{ name: b.category.name, url: `/${b.category.slug}` }] : []),
          { name, url: `/business/${b.slug}` },
        ])}
      />

      {/* Hero */}
      <header className="mx-auto max-w-5xl px-5 pb-6 pt-14 sm:px-8 sm:pt-20">
        <p className="font-data flex flex-wrap items-center gap-x-2 text-xs uppercase tracking-wide text-green">
          {b.category && (
            <Link href={`/${b.category.slug}`} className="hover:text-green-lite">
              {b.tagline ?? b.category.name}
            </Link>
          )}
          {b.location && (
            <>
              <span aria-hidden>·</span>
              <Link href={`/${b.location.slug}`} className="hover:text-green-lite">
                {b.location.name}
              </Link>
            </>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-6xl leading-[0.95] text-ink sm:text-7xl">{name}</h1>
          <div className="flex shrink-0 gap-2">
            {b.isPremium && (
              <Badge variant="premium" icon={<LeafGlyph />}>
                Premium
              </Badge>
            )}
            {b.isVerified && (
              <Badge variant="verified" icon={<VerifiedTick />}>
                Verified
              </Badge>
            )}
          </div>
        </div>

        {(rating != null || b.priceBand) && (
          <div className="mt-5 flex items-center gap-5">
            <Rating value={rating} reviews={reviewCount} />
            {b.priceBand && (
              <span className="font-data text-sm text-ink-soft">{b.priceBand}</span>
            )}
          </div>
        )}
      </header>

      {/* Premium photography / gallery */}
      {b.isPremium && (
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          {gallery.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={`${name} photo ${i + 1}`}
                  className={`w-full rounded-[var(--radius-base)] border border-line object-cover ${
                    i === 0 ? "col-span-2 row-span-2 aspect-[4/3] sm:col-span-2" : "aspect-square"
                  }`}
                />
              ))}
            </div>
          ) : (
            <div className="flex aspect-[21/9] items-center justify-center rounded-[var(--radius-base)] border border-line bg-paper-2">
              <span className="font-data text-sm text-ink-soft/70">{name} — gallery</span>
            </div>
          )}
        </div>
      )}

      <div className="mx-auto grid max-w-5xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_320px]">
        {/* Body */}
        <div>
          {b.description ? (
            <p className="text-xl leading-relaxed text-ink">{b.description}</p>
          ) : (
            <p className="text-lg text-ink-soft">
              {name} is listed on {SITE.name}. The owner hasn&apos;t written up
              their details yet.
            </p>
          )}

          {b.services && b.services.length > 0 && (
            <div className="mt-8">
              <h2 className="font-data text-xs uppercase tracking-widest text-green">
                Services
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {b.services.map((s) => (
                  <Badge key={s} variant="neutral">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Reviews (premium, owner-imported with attribution) */}
          {reviewList.length > 0 && (
            <div className="mt-12 border-t border-line pt-8">
              <h2 className="font-data text-xs uppercase tracking-widest text-green">Reviews</h2>
              <ul className="mt-5 space-y-6">
                {reviewList.map((r) => (
                  <li key={r.id}>
                    <div className="flex items-center gap-3">
                      <Rating value={r.rating} />
                      <span className="text-sm font-medium text-ink">{r.authorName}</span>
                      {r.postedAt && (
                        <span className="font-data text-xs text-ink-soft">
                          {r.postedAt.toLocaleDateString("en-GB")}
                        </span>
                      )}
                    </div>
                    {r.body && <p className="mt-2 text-ink-soft">{r.body}</p>}
                  </li>
                ))}
              </ul>
              <p className="font-data mt-6 text-xs text-ink-soft">Reviews via Google · Data © Google</p>
            </div>
          )}

          {!b.isOwned && live && (
            <p className="font-data mt-10 border-t border-line pt-4 text-xs text-ink-soft">
              Some details shown live from Google · {live.attribution}
            </p>
          )}
        </div>

        {/* Contact rail */}
        <aside className="space-y-6">
          <div className="rounded-[var(--radius-base)] border border-line bg-paper-2 p-5">
            <h2 className="font-data text-xs uppercase tracking-widest text-green">
              Details
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              {address && <Detail label="Address">{address}</Detail>}
              {b.postcode && <Detail label="Postcode">{b.postcode}</Detail>}
              {phone && (
                <Detail label="Phone">
                  <a href={`tel:${phone}`} className="hover:text-green">
                    {phone}
                  </a>
                </Detail>
              )}
              {website && (
                <Detail label="Website">
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="break-all hover:text-green"
                  >
                    {website.replace(/^https?:\/\//, "")}
                  </a>
                </Detail>
              )}
            </dl>

            {hours && hours.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="font-data text-xs uppercase tracking-widest text-green">
                  Hours
                </h3>
                <ul className="font-data mt-2 space-y-1 text-sm text-ink-soft">
                  {hours.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Premium enquiry capture */}
          {b.isPremium && (
            <div className="rounded-[var(--radius-base)] border border-line bg-paper-2 p-5">
              <h2 className="font-data mb-4 text-xs uppercase tracking-widest text-green">
                Enquire
              </h2>
              <EnquiryForm businessId={b.id} name={name} />
            </div>
          )}

          {/* Claim CTA — only for unclaimed listings (the conversion engine, spec §0) */}
          {!b.isOwned && (
            <div className="rounded-[var(--radius-base)] bg-green p-5 text-paper">
              <p className="font-medium">Is this your business?</p>
              <p className="mt-1 text-sm text-paper/85">
                Claim it free to confirm your details and replace the live Google
                data with your own.
              </p>
              <Link
                href={`/portal/claim?b=${b.slug}`}
                className="mt-4 inline-block rounded-[var(--radius-base)] bg-amber px-4 py-2 text-sm font-medium text-paper"
              >
                Claim this listing →
              </Link>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-data text-xs uppercase tracking-wide text-ink-soft">
        {label}
      </dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
