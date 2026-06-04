/**
 * Homepage crawl + tech fingerprint. Self-hosted, zero per-lookup cost (spec).
 *
 * Engine: an HTTP fetch of the homepage feeding the in-process fingerprint
 * ruleset (fingerprints.ts) — robust and dependency-free, detecting the signals
 * scoring cares about (CMS/builder, chat, booking, pixels, schema, the GHL
 * "rip-replace" signature). A headless renderer (Puppeteer) is a drop-in for
 * JS-only sites: set PUPPETEER_EXECUTABLE_PATH and swap fetchHtml() — the
 * fingerprint stage is unchanged. See docs/n8n.md.
 *
 * Mock mode: mock: URLs and the no-website case return deterministic fixtures
 * so the pipeline runs without network.
 */
import { detectTech, type TechResult } from "./fingerprints";

export type CrawlResult = {
  hasWebsite: boolean;
  tech: TechResult | null;
};

export async function crawlSite(website: string | null): Promise<CrawlResult> {
  if (!website) return { hasWebsite: false, tech: null };

  // Mock/seed websites never hit the network.
  if (website.includes(".example") || website.startsWith("mock:")) {
    return { hasWebsite: true, tech: mockTech(website) };
  }

  try {
    const page = await fetchHtml(website);
    return { hasWebsite: true, tech: detectTech(page) };
  } catch {
    // Unreachable site — still a prospect, just no tech signal.
    return { hasWebsite: true, tech: null };
  }
}

async function fetchHtml(url: string): Promise<{
  html: string;
  scripts: string[];
  headers: Record<string, string>;
}> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "HantsLocalBot/1.0 (+directory enrichment)" },
    });
    const html = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
    const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
    return { html, scripts, headers };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Deterministic fixture varied by a hash of the URL so the pipeline produces a
 * realistic mix: ~⅓ GoHighLevel (rip-replace), ~⅓ plain WordPress with no
 * capture (automation/chatbot), ~⅓ a tidy site with a chat widget.
 */
function mockTech(website: string): TechResult {
  let h = 0;
  for (const ch of website) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  const bucket = h % 3;
  if (bucket === 0) {
    return { cms: null, builder: "GoHighLevel", frameworks: [], chat: [], booking: [], pixels: [], ecommerce: [], schema: false, ghl: true };
  }
  if (bucket === 1) {
    return { cms: "WordPress", builder: null, frameworks: [], chat: [], booking: [], pixels: ["Google Analytics"], ecommerce: [], schema: false, ghl: false };
  }
  return { cms: "WordPress", builder: null, frameworks: [], chat: ["Tawk.to"], booking: ["Calendly"], pixels: ["Meta Pixel"], ecommerce: [], schema: true, ghl: false };
}
