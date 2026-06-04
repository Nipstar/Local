"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { listingContent } from "@/db/schema";
import { userOwnsBusiness, claimBusinessForUser } from "@/lib/portal";
import { uploadPhoto } from "@/lib/integrations/r2";
import { startUpgrade, billingPortalUrl } from "@/lib/billing";
import { logActivity } from "@/lib/activity";
import type { Tier } from "@/lib/integrations/stripe";

async function requireOwner(businessId: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/portal/login");
  if (!(await userOwnsBusiness(session.user.id, businessId))) {
    throw new Error("Not authorised for this business.");
  }
  return session.user.id;
}

export async function updateListingAction(formData: FormData): Promise<void> {
  const businessId = String(formData.get("businessId"));
  await requireOwner(businessId);

  const str = (k: string) => {
    const v = formData.get(k);
    return v == null || String(v).trim() === "" ? null : String(v).trim();
  };
  const services = str("services")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;

  const values = {
    businessId,
    displayName: str("displayName"),
    tagline: str("tagline"),
    description: str("description"),
    phone: str("phone"),
    email: str("email"),
    website: str("website"),
    address: str("address"),
    postcode: str("postcode"),
    priceBand: str("priceBand"),
    services,
    updatedAt: new Date(),
  };

  await db
    .insert(listingContent)
    .values(values)
    .onConflictDoUpdate({ target: listingContent.businessId, set: values });
  await logActivity(businessId, "listing_edited", {});
  revalidatePath(`/portal/listing/${businessId}`);
}

export async function uploadPhotoAction(formData: FormData): Promise<void> {
  const businessId = String(formData.get("businessId"));
  await requireOwner(businessId);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = `listings/${businessId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
  const { url } = await uploadPhoto(key, bytes, file.type || "image/jpeg");

  // Append to the photos jsonb array.
  await db
    .update(listingContent)
    .set({
      photos: sql`coalesce(${listingContent.photos}, '[]'::jsonb) || ${JSON.stringify([url])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(listingContent.businessId, businessId));
  await logActivity(businessId, "photo_uploaded", { url });
  revalidatePath(`/portal/listing/${businessId}`);
}

export async function startUpgradeAction(formData: FormData): Promise<void> {
  const businessId = String(formData.get("businessId"));
  const tier = (String(formData.get("tier")) || "premium") as Tier;
  const userId = await requireOwner(businessId);
  const session = await auth();
  void userId;
  const url = await startUpgrade({ businessId, tier, email: session?.user?.email ?? undefined });
  redirect(url);
}

export async function billingPortalAction(formData: FormData): Promise<void> {
  const businessId = String(formData.get("businessId"));
  await requireOwner(businessId);
  redirect(await billingPortalUrl(businessId));
}

/** From the public "Is this your business?" CTA → claim then edit. */
export async function claimAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const session = await auth();
  if (!session?.user?.id) redirect(`/portal/login?callbackUrl=/portal/claim?b=${slug}`);
  const res = await claimBusinessForUser(session.user.id, slug);
  if (res.ok && res.businessId) redirect(`/portal/listing/${res.businessId}`);
  redirect("/portal");
}
