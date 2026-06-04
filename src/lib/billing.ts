/**
 * Subscription state → business status (spec Phase 4). Shared by the Stripe
 * webhook and the mock-mode upgrade path.
 *
 *   premium tier, active  → business.status = 'premium' (full-bleed card)
 *   standard tier, active → business.status = 'claimed'
 *   canceled/unpaid       → premium demoted back to 'claimed'
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, subscriptions } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import {
  createCheckoutSession,
  createBillingPortal,
  stripeLive,
  type Tier,
} from "@/lib/integrations/stripe";
import { SITE } from "@/lib/config";

export async function applySubscription(input: {
  businessId: string;
  tier: Tier;
  status: string; // active | canceled | past_due | unpaid …
  stripeCustomerId?: string;
  stripeSubId?: string;
  currentPeriodEnd?: Date;
}): Promise<void> {
  const values = {
    businessId: input.businessId,
    tier: input.tier,
    status: input.status,
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripeSubId: input.stripeSubId ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
  };

  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.businessId, input.businessId))
    .limit(1);
  if (existing[0]) {
    await db.update(subscriptions).set(values).where(eq(subscriptions.id, existing[0].id));
  } else {
    await db.insert(subscriptions).values(values);
  }

  const active = input.status === "active" || input.status === "trialing";
  let nextStatus: string;
  if (active) nextStatus = input.tier === "premium" ? "premium" : "claimed";
  else nextStatus = "claimed"; // demote on cancel/non-payment

  await db
    .update(businesses)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(businesses.id, input.businessId));

  await logActivity(input.businessId, "subscription", { tier: input.tier, status: input.status });
}

/**
 * Begin an upgrade. Live: returns a Stripe Checkout URL. Mock: applies the
 * subscription immediately and returns the listing URL with ?upgraded=1.
 */
export async function startUpgrade(input: {
  businessId: string;
  tier: Tier;
  email?: string;
}): Promise<string> {
  const listingUrl = `${SITE.url}/portal/listing/${input.businessId}`;
  if (!stripeLive()) {
    await applySubscription({ businessId: input.businessId, tier: input.tier, status: "active" });
    return `${listingUrl}?upgraded=1`;
  }
  const { url } = await createCheckoutSession({
    businessId: input.businessId,
    tier: input.tier,
    email: input.email,
    successUrl: `${listingUrl}?upgraded=1`,
    cancelUrl: `${listingUrl}?canceled=1`,
  });
  return url;
}

export async function billingPortalUrl(businessId: string): Promise<string> {
  const listingUrl = `${SITE.url}/portal/listing/${businessId}`;
  const [sub] = await db
    .select({ customerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .limit(1);
  if (!stripeLive() || !sub?.customerId) return listingUrl;
  const { url } = await createBillingPortal({ customerId: sub.customerId, returnUrl: listingUrl });
  return url;
}
