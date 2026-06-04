/**
 * Shared guard for /api/workers/* routes. n8n (or any caller) must present the
 * shared secret in the X-Worker-Secret header. If N8N_WEBHOOK_SECRET is unset
 * the routes are refused outright (fail closed) rather than left open.
 */
import { env } from "@/lib/config";

export function authorizeWorker(req: Request): { ok: true } | { ok: false; status: number; message: string } {
  const secret = env.workerSecret;
  if (!secret) return { ok: false, status: 503, message: "Worker secret not configured" };
  const provided = req.headers.get("x-worker-secret");
  if (provided !== secret) return { ok: false, status: 401, message: "Unauthorized" };
  return { ok: true };
}
