import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeCode, saveConnection, verifyState } from "@/lib/integrations/gbp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/gbp/callback?code=…&state=… — store the owner's GBP tokens. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const parsed = state ? verifyState(state) : null;

  if (!code || !parsed) {
    return NextResponse.redirect(new URL("/portal?gbp=error", req.url));
  }

  // The signed state must belong to the signed-in user.
  const session = await auth();
  if (session?.user?.id !== parsed.userId) {
    return NextResponse.redirect(new URL("/portal/login", req.url));
  }

  try {
    const tokens = await exchangeCode(code);
    if (tokens) await saveConnection(parsed.userId, tokens);
  } catch {
    return NextResponse.redirect(
      new URL(`/portal/listing/${parsed.businessId}?gbp=error`, req.url),
    );
  }

  return NextResponse.redirect(
    new URL(`/portal/listing/${parsed.businessId}?gbp=connected`, req.url),
  );
}
