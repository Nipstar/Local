/**
 * Lead scoring (spec §2). Turns enrichment signals into lead_type[] + a 0–100
 * score for outreach prioritisation.
 *
 * Rules from the spec:
 *   - no site                     → web-design
 *   - ranks 4–10                  → geo
 *   - site + no capture widget    → automation
 *   - GHL signature               → rip-replace
 * Plus: a site with no chat at all → chatbot (capture opportunity).
 */
import type { TechResult } from "./integrations/fingerprints";
import type { PackRank } from "./integrations/serpapi";

export type LeadType =
  | "web-design"
  | "chatbot"
  | "geo"
  | "automation"
  | "rip-replace";

export type ScoreResult = { leadType: LeadType[]; score: number };

export function scoreLead(input: {
  hasWebsite: boolean;
  tech: TechResult | null;
  packRank: PackRank | null;
}): ScoreResult {
  const types = new Set<LeadType>();
  let score = 0;

  // No website — the strongest signal (web-design lead).
  if (!input.hasWebsite) {
    types.add("web-design");
    score += 45;
  } else {
    const tech = input.tech;
    const hasCapture =
      !!tech && (tech.chat.length > 0 || tech.booking.length > 0);

    // GHL site → rip-replace (own the relationship).
    if (tech?.ghl) {
      types.add("rip-replace");
      score += 35;
    }
    // Site but nothing capturing leads → automation / chatbot.
    if (!hasCapture) {
      types.add("automation");
      types.add("chatbot");
      score += 20;
    }
    // No analytics pixel at all → weak digital presence, small bump.
    if (tech && tech.pixels.length === 0) score += 5;
  }

  // Local rank 4–10 → geo opportunity (just off the pack).
  if (input.packRank) {
    const positions = Object.values(input.packRank);
    const best = Math.min(...positions.filter((p) => p > 0), Infinity);
    const ranksOffPack = positions.some((p) => p >= 4 && p <= 10);
    if (ranksOffPack || best === Infinity) {
      types.add("geo");
      score += best === Infinity ? 25 : 15; // unranked is a bigger gap
    }
  }

  return { leadType: [...types], score: Math.min(score, 100) };
}
