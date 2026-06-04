import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructEvent, type Tier } from "@/lib/integrations/stripe";
import { applySubscription } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook → subscriptions + business status (spec Phase 4).
 * Handles checkout completion and subscription lifecycle. Signature is verified
 * in live mode (STRIPE_WEBHOOK_SECRET); mock mode trusts the body for dev.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = constructEvent(payload, req.headers.get("stripe-signature"));
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature: ${err}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const businessId = s.metadata?.businessId;
      const tier = (s.metadata?.tier as Tier) ?? "standard";
      if (businessId) {
        await applySubscription({
          businessId,
          tier,
          status: "active",
          stripeCustomerId: typeof s.customer === "string" ? s.customer : undefined,
          stripeSubId: typeof s.subscription === "string" ? s.subscription : undefined,
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const businessId = sub.metadata?.businessId;
      const tier = (sub.metadata?.tier as Tier) ?? "standard";
      if (businessId) {
        await applySubscription({
          businessId,
          tier,
          status: sub.status,
          stripeCustomerId: typeof sub.customer === "string" ? sub.customer : undefined,
          stripeSubId: sub.id,
          currentPeriodEnd: sub.items?.data?.[0]?.current_period_end
            ? new Date(sub.items.data[0].current_period_end * 1000)
            : undefined,
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
