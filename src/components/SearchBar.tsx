"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { slug: string; name: string };

/**
 * Hero search. Term + town. On submit, routes to the most specific page we
 * can build from the inputs: /[town]/[category] when the term matches a known
 * category, otherwise /[town].
 */
export function SearchBar({
  towns,
  categories,
}: {
  towns: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [town, setTown] = useState(towns[0]?.slug ?? "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim().toLowerCase();
    const match = categories.find(
      (c) => c.name.toLowerCase() === q || c.slug === q,
    );
    if (town && match) router.push(`/${town}/${match.slug}`);
    else if (town) router.push(`/${town}`);
    else if (match) router.push(`/${match.slug}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-2 rounded-[var(--radius-base)] border border-line bg-paper-2 p-2 shadow-[var(--shadow)] sm:flex-row sm:items-center"
    >
      <label className="flex flex-1 items-center gap-3 px-3">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="6" stroke="var(--ink-soft)" strokeWidth="1.6" />
          <path d="M14 14l3 3" stroke="var(--ink-soft)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Plumber, café, florist…"
          className="h-12 w-full bg-transparent text-ink placeholder:text-ink-soft focus:outline-none"
          aria-label="What are you looking for?"
        />
      </label>

      <div className="hidden h-8 w-px bg-line sm:block" />

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 px-3">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M10 18s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z"
              stroke="var(--ink-soft)"
              strokeWidth="1.5"
            />
            <circle cx="10" cy="8" r="2" stroke="var(--ink-soft)" strokeWidth="1.5" />
          </svg>
          <select
            value={town}
            onChange={(e) => setTown(e.target.value)}
            className="h-12 bg-transparent pr-2 text-ink focus:outline-none"
            aria-label="Town"
          >
            {towns.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="h-12 rounded-[var(--radius-base)] bg-amber px-6 font-medium text-paper transition-opacity hover:opacity-90"
        >
          Search →
        </button>
      </div>
    </form>
  );
}
