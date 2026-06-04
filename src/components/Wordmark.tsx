import Link from "next/link";
import { SITE } from "@/lib/config";

/** The HantsLocal wordmark: botanical swirl + two-tone name. */
export function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        fill="none"
        aria-hidden
        className="text-green"
      >
        <path
          d="M7 20c0-7 4-11 11-12-1 4-2 7-4 9M7 20c5 0 9-2 11-5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-xl tracking-tight text-ink">
        {SITE.wordmark.lead}
        <span className="text-green">{SITE.wordmark.tail}</span>
      </span>
    </Link>
  );
}
