import type { ReactNode } from "react";

type Variant = "premium" | "verified" | "neutral";

const styles: Record<Variant, string> = {
  premium: "bg-green text-paper",
  verified: "bg-green text-paper",
  neutral: "bg-paper-2 text-ink-soft border border-line",
};

/** Small mono pill used for Premium / Verified flags (mockup). */
export function Badge({
  variant = "neutral",
  children,
  icon,
}: {
  variant?: Variant;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span
      className={`font-data inline-flex items-center gap-1.5 rounded-[var(--radius-base)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${styles[variant]}`}
    >
      {icon}
      {children}
    </span>
  );
}

/** Verified tick used inside the badge. */
export function VerifiedTick() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M5 8.2l2 2 4-4.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Leaf/tag glyph for the Premium badge. */
export function LeafGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M13 3C7 3 3 6.5 3 11c4.5 0 8-4 10-8z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Amber star + mono rating, e.g. ★ 4.9 · 214 reviews. */
export function Rating({
  value,
  reviews,
}: {
  value?: number | null;
  reviews?: number | null;
}) {
  if (value == null) return null;
  return (
    <span className="font-data inline-flex items-center gap-1.5 text-sm text-ink">
      <span className="text-amber" aria-hidden>
        ★
      </span>
      <span className="font-medium">{value.toFixed(1)}</span>
      {reviews != null && (
        <span className="text-ink-soft">{reviews} reviews</span>
      )}
    </span>
  );
}
