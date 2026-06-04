import { NextResponse } from "next/server";
import { authorizeWorker } from "@/lib/worker-auth";
import { enrichBusiness } from "@/lib/workers/enrich";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/workers/enrich   (n8n, or on-demand re-check)
 * Header: X-Worker-Secret
 * Body: { businessId: string }
 * Enriches a single business synchronously (bypasses the queue).
 */
export async function POST(req: Request) {
  const auth = authorizeWorker(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as { businessId?: string };
  if (!body.businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  await enrichBusiness(body.businessId);
  return NextResponse.json({ ok: true, businessId: body.businessId });
}
