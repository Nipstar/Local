"use client";

import { useActionState } from "react";
import { enquiryAction, type EnquiryState } from "@/app/(public)/business/[slug]/actions";

/** Premium enquiry capture form (spec Phase 5). */
export function EnquiryForm({ businessId, name }: { businessId: string; name: string }) {
  const [state, formAction, pending] = useActionState<EnquiryState, FormData>(enquiryAction, {
    status: "idle",
  });

  if (state.status === "success") {
    return (
      <p className="rounded-[var(--radius-base)] bg-green px-4 py-3 text-sm text-paper">
        Thanks — your enquiry has been sent to {name}.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="businessId" value={businessId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" placeholder="Your name" className="rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2 text-sm text-ink" />
        <input name="phone" placeholder="Phone (optional)" className="rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2 text-sm text-ink" />
      </div>
      <input name="email" type="email" required placeholder="Email" className="w-full rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2 text-sm text-ink" />
      <textarea name="message" required rows={3} placeholder={`How can ${name} help?`} className="w-full rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2 text-sm text-ink" />
      {state.status === "error" && <p className="font-data text-xs text-amber">{state.message}</p>}
      <button disabled={pending} className="rounded-[var(--radius-base)] bg-amber px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-60">
        {pending ? "Sending…" : "Send enquiry →"}
      </button>
    </form>
  );
}
