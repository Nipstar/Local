/**
 * Claim tokens + the confirm-your-details conversion (spec §0 / Phase 3).
 *
 * A tokenised link is the auth boundary for the pre-login confirm flow: the
 * owner opens /confirm/[token], sees their seed + live Google details, and on
 * confirm we WRITE listing_content (owned) and flip the business to 'confirmed'
 * — converting transient Google data into owned, indexable content.
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, claims, listingContent } from "@/db/schema";
import { SITE } from "@/lib/config";
import { placeDetails } from "@/lib/integrations/places";
import { logActivity } from "@/lib/activity";

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Create (or reuse an unverified) claim token for a business; returns the URL. */
export async function createClaimToken(
  businessId: string,
): Promise<{ token: string; url: string }> {
  const existing = await db
    .select()
    .from(claims)
    .where(eq(claims.businessId, businessId))
    .limit(1);

  let token = existing.find((c) => !c.verifiedAt)?.token ?? null;
  if (!token) {
    token = newToken();
    await db.insert(claims).values({ businessId, token });
  }
  return { token, url: `${SITE.url}/confirm/${token}` };
}

export type ConfirmPrefill = {
  token: string;
  businessId: string;
  status: string;
  alreadyVerified: boolean;
  name: string;
  category: string | null;
  location: string | null;
  /** Seed/owned values to pre-fill the form. */
  prefill: {
    displayName: string;
    tagline: string;
    description: string;
    phone: string;
    email: string;
    website: string;
    address: string;
    postcode: string;
  };
  /** Transient Google source shown alongside (attribution required). */
  googleSource: { phone: string | null; address: string | null; attribution: string } | null;
};

export async function getClaimPrefill(token: string): Promise<ConfirmPrefill | null> {
  const [claim] = await db.select().from(claims).where(eq(claims.token, token)).limit(1);
  if (!claim?.businessId) return null;

  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, claim.businessId))
    .limit(1);
  if (!biz) return null;

  const [content] = await db
    .select()
    .from(listingContent)
    .where(eq(listingContent.businessId, biz.id))
    .limit(1);

  // Live Google details to help the owner confirm (transient, attributed).
  let google: ConfirmPrefill["googleSource"] = null;
  try {
    const d = await placeDetails(biz.placeId);
    if (d) google = { phone: d.phone, address: d.address, attribution: d.attribution };
  } catch {
    google = null;
  }

  return {
    token,
    businessId: biz.id,
    status: biz.status,
    alreadyVerified: Boolean(claim.verifiedAt),
    name: biz.name,
    category: null,
    location: null,
    prefill: {
      displayName: content?.displayName ?? biz.name,
      tagline: content?.tagline ?? "",
      description: content?.description ?? "",
      phone: content?.phone ?? google?.phone ?? "",
      email: content?.email ?? "",
      website: content?.website ?? "",
      address: content?.address ?? google?.address ?? "",
      postcode: content?.postcode ?? "",
    },
    googleSource: google,
  };
}

export type ConfirmInput = {
  displayName: string;
  tagline?: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  postcode?: string;
};

/** Persist owner-confirmed details as OWNED content and flip status. */
export async function confirmClaim(
  token: string,
  input: ConfirmInput,
): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const [claim] = await db.select().from(claims).where(eq(claims.token, token)).limit(1);
  if (!claim?.businessId) return { ok: false, error: "Invalid or expired link." };

  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, claim.businessId))
    .limit(1);
  if (!biz) return { ok: false, error: "Business not found." };

  const values = {
    businessId: biz.id,
    displayName: input.displayName.trim(),
    tagline: input.tagline?.trim() || null,
    description: input.description?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    website: input.website?.trim() || null,
    address: input.address?.trim() || null,
    postcode: input.postcode?.trim() || null,
    updatedAt: new Date(),
  };

  await db
    .insert(listingContent)
    .values(values)
    .onConflictDoUpdate({ target: listingContent.businessId, set: values });

  // Don't demote an already-claimed/premium business.
  const nextStatus = ["claimed", "premium"].includes(biz.status) ? biz.status : "confirmed";
  await db
    .update(businesses)
    .set({ status: nextStatus, name: values.displayName, updatedAt: new Date() })
    .where(eq(businesses.id, biz.id));

  await db.update(claims).set({ verifiedAt: new Date() }).where(eq(claims.id, claim.id));

  await logActivity(biz.id, "confirmed", { via: "confirm-link", email: values.email });

  return { ok: true, slug: biz.slug };
}
