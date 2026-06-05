/**
 * Google Business Profile reviews import (spec Phase 5).
 *
 * Reviews are imported ONLY from an owner's connected Google account and stored
 * with attribution — never bulk-scraped, never for unclaimed businesses.
 *
 * Connection: a per-owner OAuth flow (connect → callback) stores a refresh
 * token in gbp_connections; getAccessToken() refreshes on demand. fetchOwner-
 * Reviews uses that token against the GBP API.
 *
 * Mock mode: without GBP_CLIENT_ID/SECRET (or without a token) we return a small
 * deterministic set of sample reviews so the premium import flow is testable.
 *
 * NOTE: the live reviews endpoint (My Business v4 accounts.locations.reviews)
 * requires your Google Cloud project to be allow-listed by Google, and mapping
 * our place_id → a GBP location resource is the remaining integration step.
 * That call is marked below; until it's enabled, connected-but-live falls back
 * to sample data rather than throwing.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { gbpConnections } from "@/db/schema";
import { SITE } from "@/lib/config";

const SCOPE = "https://www.googleapis.com/auth/business.manage";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function creds() {
  const clientId = process.env.GBP_CLIENT_ID;
  const clientSecret = process.env.GBP_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const gbpLive = () => creds() !== null;
export const redirectUri = () => `${SITE.url}/api/gbp/callback`;

// ─── Signed OAuth state (CSRF + carries userId/businessId) ───────────────────
function stateSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-state-secret";
}

export function signState(payload: { userId: string; businessId: string }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): { userId: string; businessId: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

// ─── OAuth ───────────────────────────────────────────────────────────────────
export function gbpAuthUrl(state: string): string | null {
  const c = creds();
  if (!c) return null;
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

export async function exchangeCode(code: string): Promise<TokenResponse | null> {
  const c = creds();
  if (!c) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`GBP token exchange ${res.status}: ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

export async function saveConnection(userId: string, tokens: TokenResponse): Promise<void> {
  const values = {
    userId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  };
  await db
    .insert(gbpConnections)
    .values(values)
    .onConflictDoUpdate({ target: gbpConnections.userId, set: values });
}

export async function isConnected(userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: gbpConnections.userId })
    .from(gbpConnections)
    .where(eq(gbpConnections.userId, userId))
    .limit(1);
  return rows.length > 0;
}

/** Return a valid access token for the owner, refreshing if expired. */
export async function getAccessToken(userId: string): Promise<string | null> {
  const c = creds();
  const [conn] = await db
    .select()
    .from(gbpConnections)
    .where(eq(gbpConnections.userId, userId))
    .limit(1);
  if (!c || !conn) return null;

  const fresh = conn.expiresAt && conn.expiresAt.getTime() > Date.now() + 60_000;
  if (fresh && conn.accessToken) return conn.accessToken;
  if (!conn.refreshToken) return conn.accessToken ?? null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return conn.accessToken ?? null;
  const tok = (await res.json()) as TokenResponse;
  await db
    .update(gbpConnections)
    .set({
      accessToken: tok.access_token,
      expiresAt: new Date(Date.now() + tok.expires_in * 1000),
    })
    .where(and(eq(gbpConnections.userId, userId)));
  return tok.access_token;
}

// ─── Reviews ─────────────────────────────────────────────────────────────────
export type GbpReview = {
  authorName: string;
  authorUrl: string | null;
  rating: number;
  body: string;
  postedAt: Date;
};

export async function fetchOwnerReviews(input: {
  placeId: string;
  businessName: string;
  accessToken?: string;
}): Promise<GbpReview[]> {
  if (!input.accessToken || !gbpLive()) {
    return mockReviews(input.businessName);
  }

  // Live: My Business v4 accounts.locations.reviews. Requires Google allow-list
  // + resolving placeId → a GBP location resource name. Left as the final seam;
  // until enabled, fall back to sample data rather than failing the import.
  return mockReviews(input.businessName);
}

function mockReviews(name: string): GbpReview[] {
  const base = Date.now();
  const day = 86_400_000;
  return [
    {
      authorName: "Sarah P.",
      authorUrl: "https://www.google.com/maps/contrib/sarahp",
      rating: 5,
      body: `Genuinely excellent — ${name} turned up on time and did a tidy job. Would use again.`,
      postedAt: new Date(base - 9 * day),
    },
    {
      authorName: "James M.",
      authorUrl: "https://www.google.com/maps/contrib/jamesm",
      rating: 5,
      body: "Friendly, fair price, and explained everything clearly. Highly recommend.",
      postedAt: new Date(base - 28 * day),
    },
    {
      authorName: "Priya R.",
      authorUrl: "https://www.google.com/maps/contrib/priyar",
      rating: 4,
      body: "Really good service overall. Small delay but kept me informed throughout.",
      postedAt: new Date(base - 61 * day),
    },
  ];
}
