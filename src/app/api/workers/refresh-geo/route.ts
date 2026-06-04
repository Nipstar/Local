import { NextResponse } from "next/server";
import { authorizeWorker } from "@/lib/worker-auth";
import { refreshStaleGeo } from "@/lib/workers/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/workers/refresh-geo   (n8n daily — 30-day lat/lng compliance)
 * Header: X-Worker-Secret
 * Body: { olderThanDays?: number, limit?: number }
 */
export async function POST(req: Request) {
  const auth = authorizeWorker(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as {
    olderThanDays?: number;
    limit?: number;
  };
  const summary = await refreshStaleGeo(body);
  return NextResponse.json({ ok: true, summary });
}
