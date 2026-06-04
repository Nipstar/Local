"use client";

import { useState, useTransition } from "react";
import { generateConfirmLinkAction } from "@/app/(admin)/admin/actions";

/** Generates (or reveals) the tokenised confirm-your-details link for a prospect. */
export function ConfirmLinkButton({ businessId }: { businessId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <button
        onClick={() => start(async () => setUrl((await generateConfirmLinkAction(businessId)).url))}
        disabled={pending}
        className="rounded-[var(--radius-base)] bg-green px-4 py-2 text-sm text-paper disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate confirm link"}
      </button>
      {url && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="font-data w-full rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2 text-xs text-ink"
          />
          <button
            onClick={() => {
              navigator.clipboard?.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="shrink-0 rounded-[var(--radius-base)] border border-line px-3 py-2 text-xs hover:bg-paper-2"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
