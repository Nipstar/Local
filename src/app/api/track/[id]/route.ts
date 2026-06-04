import { NextResponse } from "next/server";
import { recordView } from "@/lib/engagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/track/[id] — increment a listing's view counter (client beacon). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await recordView(id).catch(() => {});
  return NextResponse.json({ ok: true });
}
