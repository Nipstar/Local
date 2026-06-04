/**
 * Google Places API (New) adapter — Text Search + Place Details.
 *
 * Spec §0 compliance: only `place_id` is persisted. Everything returned by
 * `placeDetails` (rating, hours, phone, etc.) is TRANSIENT — used to seed a
 * claim or live-rendered with Google attribution, never stored as our own.
 *
 * Mock mode: when PLACES_API_KEY is absent the adapter returns deterministic
 * fixture data so discovery and the public live-fetch are runnable in dev.
 */
import { env, features } from "@/lib/config";

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

export type PlaceSearchResult = {
  placeId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  website: string | null;
};

/** Transient details — display only, with attribution. Never persisted. */
export type PlaceDetails = {
  placeId: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  hours: string[] | null;
  /** Google attribution is required whenever these are displayed. */
  attribution: "Data © Google";
};

// ─── Text Search (discovery) ────────────────────────────────────────────────
export async function textSearch(
  category: string,
  town: string,
): Promise<PlaceSearchResult[]> {
  if (!features.livePlaces) return mockTextSearch(category, town);

  const res = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.placesApiKey!,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.formattedAddress,places.websiteUri",
    },
    body: JSON.stringify({
      textQuery: `${category} in ${town}, Hampshire`,
      regionCode: "GB",
    }),
  });
  if (!res.ok) throw new Error(`Places textSearch ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { places?: GooglePlace[] };
  return (data.places ?? []).map(toSearchResult);
}

// ─── Place Details (transient) ──────────────────────────────────────────────
export async function placeDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!features.livePlaces) return mockDetails(placeId);

  const res = await fetch(`${DETAILS_URL}/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": env.placesApiKey!,
      "X-Goog-FieldMask":
        "id,displayName,rating,userRatingCount,nationalPhoneNumber,websiteUri,formattedAddress,regularOpeningHours",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Places details ${res.status}: ${await res.text()}`);
  const p = (await res.json()) as GooglePlace;
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "",
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    address: p.formattedAddress ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? null,
    attribution: "Data © Google",
  };
}

// ─── Location refresh (30-day cache compliance, spec §0) ────────────────────
export async function placeLocation(
  placeId: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!features.livePlaces) return mockLocation(placeId);
  const res = await fetch(`${DETAILS_URL}/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": env.placesApiKey!,
      "X-Goog-FieldMask": "location",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Places location ${res.status}: ${await res.text()}`);
  const p = (await res.json()) as GooglePlace;
  return p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null;
}

function mockLocation(placeId: string): { lat: number; lng: number } {
  // Deterministic, stable per place_id.
  let h = 0;
  for (const ch of placeId) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return { lat: 50.8 + (h % 1000) / 2000, lng: -1.6 + ((h >> 3) % 1000) / 1000 };
}

// ─── Internal Google shapes ─────────────────────────────────────────────────
type GooglePlace = {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
};

function toSearchResult(p: GooglePlace): PlaceSearchResult {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "",
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    address: p.formattedAddress ?? null,
    website: p.websiteUri ?? null,
  };
}

// ─── Mock mode ──────────────────────────────────────────────────────────────
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function mockTextSearch(category: string, town: string): PlaceSearchResult[] {
  // Two deterministic prospects per category×town: one with a site, one without.
  return [0, 1].map((i) => {
    const name = `${town} ${category} ${i === 0 ? "Co." : "& Daughters"}`;
    return {
      placeId: `mock:${slug(town)}:${slug(category)}:${i}`,
      name,
      lat: 51 + Math.random() * 0.3,
      lng: -1.3 + Math.random() * 0.4,
      address: `${10 + i} High Street, ${town}, Hampshire`,
      website: i === 0 ? `https://${slug(name)}.example` : null,
    };
  });
}

function mockDetails(placeId: string): PlaceDetails {
  const parts = placeId.startsWith("mock:") ? placeId.split(":") : [];
  const name = parts.length ? parts.slice(1, 3).join(" ") : "Sample Business";
  // Mirror mockTextSearch: the ":0" prospect has a site, ":1" doesn't. This
  // exercises the tech-fingerprint scoring branches (rip-replace/automation).
  const hasSite = parts[3] === "0";
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return {
    placeId,
    name,
    rating: 4.6,
    reviewCount: 73,
    phone: "01962 000000",
    website: hasSite ? `https://${slug(name || "business")}.example` : null,
    address: "High Street, Hampshire",
    hours: ["Mon–Fri 9–5", "Sat 9–1", "Sun closed"],
    attribution: "Data © Google",
  };
}
