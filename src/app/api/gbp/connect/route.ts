import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { gbpAuthUrl, gbpLive, signState } from "@/lib/integrations/gbp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/gbp/connect?businessId=…
 * Starts the owner's Google Business Profile OAuth (premium review import).
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/portal/login", req.url));
  }
  const businessId = new URL(req.url).searchParams.get("businessId") ?? "";

  if (!gbpLive()) {
    // No Google creds configured → nothing to connect; bounce back.
    return NextResponse.redirect(new URL(`/portal/listing/${businessId}?gbp=unavailable`, req.url));
  }

  const url = gbpAuthUrl(signState({ userId: session.user.id, businessId }));
  return NextResponse.redirect(url!);
}
