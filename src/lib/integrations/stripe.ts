/**
 * Stripe adapter — subscriptions via Checkout + hosted Customer Portal (spec
 * Phase 4). We don't build billing UI; Stripe hosts it.
 *
 * Mock mode: when STRIPE_SECRET_KEY is absent, checkout/portal return local
 * URLs and the upgrade is applied directly (see lib/billing.ts), so the
 * upgrade → premium flow is testable without Stripe.
 */
import Stripe from "stripe";

export type Tier = "standard" | "premium";

let _client: Stripe | null = null;
function client(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_client) _client = new Stripe(key);
  return _client;
}

export const stripeLive = () => client() !== null;

function priceFor(tier: Tier): string | undefined {
  return tier === "premium"
    ? process.env.STRIPE_PRICE_PREMIUM
    : process.env.STRIPE_PRICE_STANDARD;
}

export async function createCheckoutSession(input: {
  businessId: string;
  tier: Tier;
  email?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; mocked: boolean }> {
  const s = client();
  if (!s) return { url: input.successUrl, mocked: true };

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceFor(input.tier)!, quantity: 1 }],
    customer_email: input.email,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { businessId: input.businessId, tier: input.tier },
    subscription_data: { metadata: { businessId: input.businessId, tier: input.tier } },
  });
  return { url: session.url ?? input.successUrl, mocked: false };
}

export async function createBillingPortal(input: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string; mocked: boolean }> {
  const s = client();
  if (!s) return { url: input.returnUrl, mocked: true };
  const session = await s.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
  });
  return { url: session.url, mocked: false };
}

/** Verify + parse a webhook event (throws on bad signature in live mode). */
export function constructEvent(payload: string, signature: string | null): Stripe.Event {
  const s = client();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret || !signature) {
    // Mock: trust the body (dev only).
    return JSON.parse(payload) as Stripe.Event;
  }
  return s.webhooks.constructEvent(payload, signature, secret);
}
