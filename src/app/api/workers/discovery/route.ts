import { NextResponse } from "next/server";
import { authorizeWorker } from "@/lib/worker-auth";
import { runDiscovery, type DiscoveryOptions } from "@/lib/workers/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/workers/discovery   (n8n scheduled)
 * Header: X-Worker-Secret
 * Body (optional): { categorySlugs?, townSlugs?, limitPairs? }
 */
export async function POST(req: Request) {
  const auth = authorizeWorker(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  let opts: DiscoveryOptions = {};
  try {
    opts = (await req.json()) as DiscoveryOptions;
  } catch {
    // empty body → full sweep
  }

  const summary = await runDiscovery(opts);
  return NextResponse.json({ ok: true, summary });
}
