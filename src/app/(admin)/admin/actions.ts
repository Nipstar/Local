"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { BUSINESS_STATUS } from "@/db/schema";
import { createClaimToken } from "@/lib/claims";
import { logActivity } from "@/lib/activity";
import { ensureContact, getOrCreateCampaign, runCampaignStep, type EntityType } from "@/lib/outreach";
import { enrichBusiness } from "@/lib/workers/enrich";
import { requireAdmin } from "@/lib/admin-auth";
import { approveClaim } from "@/lib/portal";

export async function setStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("businessId"));
  const status = String(formData.get("status"));
  if (!BUSINESS_STATUS.includes(status as never)) return;
  await db.update(businesses).set({ status, updatedAt: new Date() }).where(eq(businesses.id, id));
  await logActivity(id, "status_changed", { status });
  revalidatePath(`/admin/business/${id}`);
  revalidatePath("/admin");
}

export async function saveContactAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("businessId"));
  const email = String(formData.get("email") ?? "").trim();
  const entityType = String(formData.get("entityType") ?? "ltd") as EntityType;
  const consentBasis = String(formData.get("consentBasis") ?? "").trim() || undefined;
  if (!email) return;
  await ensureContact(id, { email, entityType, consentBasis });
  await logActivity(id, "contact_saved", { email, entityType });
  revalidatePath(`/admin/business/${id}`);
}

export async function reenrichAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("businessId"));
  await enrichBusiness(id);
  await logActivity(id, "reenriched", {});
  revalidatePath(`/admin/business/${id}`);
}

/** Invoked from a client component; returns the confirm URL to display. */
export async function generateConfirmLinkAction(businessId: string): Promise<{ url: string }> {
  await requireAdmin();
  const { url } = await createClaimToken(businessId);
  await logActivity(businessId, "confirm_link_generated", {});
  return { url };
}

export async function runCampaignAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("campaign") ?? "Confirm your details").trim();
  const campaignId = await getOrCreateCampaign(name);
  await runCampaignStep(campaignId, { limit: 200 });
  revalidatePath("/admin");
}

/** Approve a pending self-serve claim (claim hardening). */
export async function approveClaimAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const claimId = String(formData.get("claimId"));
  const businessId = String(formData.get("businessId"));
  await approveClaim(claimId);
  revalidatePath(`/admin/business/${businessId}`);
  revalidatePath("/admin");
}
