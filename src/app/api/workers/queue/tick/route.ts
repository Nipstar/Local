import { NextResponse } from "next/server";
import { authorizeWorker } from "@/lib/worker-auth";
import { runEnrichQueue } from "@/lib/workers/enrich";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/workers/queue/tick   (n8n every few minutes)
 * Header: X-Worker-Secret
 * Body (optional): { batch?: number }
 * Drains a batch of queued enrich jobs.
 */
export async function POST(req: Request) {
  const auth = authorizeWorker(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  let batch = 25;
  try {
    const body = (await req.json()) as { batch?: number };
    if (body.batch) batch = body.batch;
  } catch {
    // default batch
  }

  const summary = await runEnrichQueue(batch);
  return NextResponse.json({ ok: true, summary });
}
