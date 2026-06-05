/**
 * Admin access control (Phase 4 sequencing — admin was open by design until
 * auth existed). Admins sign in with the same magic link as owners; an email
 * allowlist (ADMIN_EMAILS) grants the admin area.
 *
 * Fail-closed in production: if ADMIN_EMAILS is unset, no one is admin. In
 * development the area stays open when no allowlist is configured, for
 * convenience.
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/**
 * Guard for the (admin) group. Returns the session, or redirects:
 *   - not signed in        → /portal/login (callback back to admin)
 *   - signed in, not admin → home
 * In dev with no ADMIN_EMAILS set, the area is left open.
 */
export async function requireAdmin(path = "/admin") {
  const allowlistConfigured = adminEmails().length > 0;
  if (!allowlistConfigured && process.env.NODE_ENV !== "production") {
    return await auth(); // open in dev when unconfigured
  }
  const session = await auth();
  if (!session?.user) redirect(`/portal/login?callbackUrl=${encodeURIComponent(path)}`);
  if (!isAdminEmail(session.user.email)) redirect("/");
  return session;
}
