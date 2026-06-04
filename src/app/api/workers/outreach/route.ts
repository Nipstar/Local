import { NextResponse } from "next/server";
import { authorizeWorker } from "@/lib/worker-auth";
import { getOrCreateCampaign, runCampaignStep } from "@/lib/outreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/workers/outreach   (n8n scheduled — the sequence cadence)
 * Header: X-Worker-Secret
 * Body: { campaign?: string, limit?: number }
 * Sends the next due step to each eligible contact.
 */
export async function POST(req: Request) {
  const auth = authorizeWorker(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as { campaign?: string; limit?: number };
  const campaignId = await getOrCreateCampaign(body.campaign ?? "Confirm your details");
  const summary = await runCampaignStep(campaignId, { limit: body.limit ?? 200 });
  return NextResponse.json({ ok: true, campaignId, summary });
}
