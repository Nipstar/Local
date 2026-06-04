"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmAction, type ConfirmState } from "@/app/(public)/confirm/[token]/actions";
import type { ConfirmPrefill } from "@/lib/claims";

export function ConfirmForm({ prefill }: { prefill: ConfirmPrefill }) {
  const [state, formAction, pending] = useActionState<ConfirmState, FormData>(
    confirmAction,
    { status: "idle" },
  );

  if (state.status === "success") {
    return (
      <div className="rounded-[var(--radius-base)] border border-line bg-paper-2 p-8 text-center">
        <p className="font-data text-xs uppercase tracking-widest text-green">Confirmed</p>
        <h2 className="mt-3 text-3xl text-ink">Your listing is live.</h2>
        <p className="mt-3 text-ink-soft">
          Thanks — these are now your own details, not Google&apos;s.
        </p>
        <Link
          href={`/business/${state.slug}`}
          className="mt-6 inline-block rounded-[var(--radius-base)] bg-green px-5 py-2.5 text-paper"
        >
          View your listing →
        </Link>
      </div>
    );
  }

  const p = prefill.prefill;
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={prefill.token} />

      <Field name="displayName" label="Business name" defaultValue={p.displayName} required />
      <Field name="tagline" label="Tagline" defaultValue={p.tagline} placeholder="e.g. Plumbing & Heating" />
      <label className="block">
        <span className="font-data text-xs uppercase tracking-wide text-ink-soft">Description</span>
        <textarea
          name="description"
          defaultValue={p.description}
          rows={4}
          className="mt-1 w-full rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2 text-ink"
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="phone" label="Phone" defaultValue={p.phone} />
        <Field name="email" label="Email" type="email" defaultValue={p.email} />
        <Field name="website" label="Website" defaultValue={p.website} />
        <Field name="postcode" label="Postcode" defaultValue={p.postcode} />
      </div>
      <Field name="address" label="Address" defaultValue={p.address} />

      {state.status === "error" && (
        <p className="font-data text-sm text-amber">{state.message}</p>
      )}

      <button
        disabled={pending}
        className="rounded-[var(--radius-base)] bg-amber px-6 py-3 font-medium text-paper disabled:opacity-60"
      >
        {pending ? "Saving…" : "Confirm my details →"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-data text-xs uppercase tracking-wide text-ink-soft">
        {label}
        {required && <span className="text-amber"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-[var(--radius-base)] border border-line bg-paper px-3 py-2 text-ink"
      />
    </label>
  );
}
