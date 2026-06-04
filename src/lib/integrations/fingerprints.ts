/**
 * Compact technology fingerprint ruleset — the in-TypeScript stand-in for the
 * Go `wappalyzergo` engine named in the spec (kept in-process; no Go sidecar,
 * zero per-lookup cost). Each rule matches against the fetched HTML, response
 * headers, or script `src` URLs. Extend freely — the shape mirrors Wappalyzer's
 * technologies dataset so it can be swapped for the full set later.
 */
export type TechCategory =
  | "cms"
  | "builder"
  | "framework"
  | "chat"
  | "booking"
  | "pixel"
  | "ecommerce";

export type Fingerprint = {
  name: string;
  category: TechCategory;
  /** RegExp source strings, tested case-insensitively. */
  html?: string[];
  scripts?: string[];
  headers?: { name: string; pattern?: string }[];
  /** Marks the "rip-replace" target (spec: GHL signature → rip-replace). */
  ghl?: boolean;
};

export const FINGERPRINTS: Fingerprint[] = [
  // ── Site builders / CMS ──
  {
    name: "GoHighLevel",
    category: "builder",
    ghl: true,
    html: ["msgsndr", "gohighlevel", "leadconnectorhq"],
    scripts: ["leadconnectorhq\\.com", "msgsndr\\.com"],
  },
  { name: "WordPress", category: "cms", html: ["wp-content", "wp-includes"], headers: [{ name: "x-powered-by", pattern: "wordpress" }] },
  { name: "Wix", category: "builder", html: ["wix\\.com", "_wixCssStates"], scripts: ["static\\.parastorage\\.com"] },
  { name: "Squarespace", category: "builder", html: ["squarespace", "static1\\.squarespace\\.com"] },
  { name: "Webflow", category: "builder", html: ["webflow", "wf-"], scripts: ["assets\\.website-files\\.com"] },
  { name: "Shopify", category: "ecommerce", html: ["cdn\\.shopify\\.com", "Shopify\\."], scripts: ["cdn\\.shopify\\.com"] },
  { name: "Duda", category: "builder", html: ["dudamobile", "dudaone"] },

  // ── Frameworks ──
  { name: "Next.js", category: "framework", html: ["__next", "/_next/"], scripts: ["/_next/"] },
  { name: "React", category: "framework", html: ["data-reactroot", "react"] },

  // ── Chat widgets (capture) ──
  { name: "Intercom", category: "chat", scripts: ["widget\\.intercom\\.io"], html: ["intercom"] },
  { name: "Tawk.to", category: "chat", scripts: ["embed\\.tawk\\.to"] },
  { name: "Crisp", category: "chat", scripts: ["client\\.crisp\\.chat"] },
  { name: "Tidio", category: "chat", scripts: ["code\\.tidio\\.co"] },
  { name: "HubSpot", category: "chat", scripts: ["js\\.hs-scripts\\.com", "js\\.hsforms\\.net"] },

  // ── Booking (capture) ──
  { name: "Calendly", category: "booking", scripts: ["assets\\.calendly\\.com"], html: ["calendly"] },
  { name: "Acuity", category: "booking", html: ["acuityscheduling"] },

  // ── Pixels ──
  { name: "Meta Pixel", category: "pixel", html: ["fbq\\(", "connect\\.facebook\\.net"] },
  { name: "Google Analytics", category: "pixel", html: ["gtag\\(", "googletagmanager\\.com", "google-analytics\\.com"] },
];

export type TechResult = {
  cms: string | null;
  builder: string | null;
  frameworks: string[];
  chat: string[];
  booking: string[];
  pixels: string[];
  ecommerce: string[];
  schema: boolean;
  ghl: boolean;
};

/** Apply the ruleset to a fetched page. */
export function detectTech(input: {
  html: string;
  scripts: string[];
  headers: Record<string, string>;
}): TechResult {
  const hay = input.html.toLowerCase();
  const scriptStr = input.scripts.join(" ").toLowerCase();

  const matched = FINGERPRINTS.filter((fp) => {
    if (fp.html?.some((p) => new RegExp(p, "i").test(hay))) return true;
    if (fp.scripts?.some((p) => new RegExp(p, "i").test(scriptStr))) return true;
    if (
      fp.headers?.some((h) => {
        const v = input.headers[h.name.toLowerCase()];
        if (!v) return false;
        return h.pattern ? new RegExp(h.pattern, "i").test(v) : true;
      })
    )
      return true;
    return false;
  });

  const byCat = (c: TechCategory) => matched.filter((m) => m.category === c).map((m) => m.name);

  return {
    cms: byCat("cms")[0] ?? null,
    builder: byCat("builder")[0] ?? null,
    frameworks: byCat("framework"),
    chat: byCat("chat"),
    booking: byCat("booking"),
    pixels: byCat("pixel"),
    ecommerce: byCat("ecommerce"),
    schema: /application\/ld\+json/i.test(input.html),
    ghl: matched.some((m) => m.ghl),
  };
}
