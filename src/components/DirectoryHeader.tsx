import Link from "next/link";

/** Oversized editorial header for town / category / town+category pages (spec §2). */
export function DirectoryHeader({
  eyebrow,
  title,
  intro,
  count,
  crumbs,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  count?: number;
  crumbs?: { name: string; href: string }[];
}) {
  return (
    <header className="mx-auto max-w-6xl px-5 pb-8 pt-14 sm:px-8 sm:pt-20">
      {crumbs && crumbs.length > 0 && (
        <nav className="font-data mb-6 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-ink-soft">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>/</span>}
              <Link href={c.href} className="hover:text-green">
                {c.name}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <p className="font-data text-xs uppercase tracking-widest text-green">
        {eyebrow}
        {count != null && (
          <span className="text-ink-soft">
            {" "}
            · {count.toLocaleString("en-GB")} listed
          </span>
        )}
      </p>
      <h1 className="reveal mt-4 max-w-4xl text-6xl leading-[0.95] text-ink sm:text-7xl">
        {title}
      </h1>
      {intro && (
        <p className="reveal mt-5 max-w-2xl text-lg text-ink-soft" style={{ animationDelay: "60ms" }}>
          {intro}
        </p>
      )}
    </header>
  );
}
