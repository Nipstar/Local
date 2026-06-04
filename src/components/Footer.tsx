import Link from "next/link";
import { SITE } from "@/lib/config";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-paper-2">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p className="font-display text-lg text-ink">
              {SITE.wordmark.lead}
              <span className="text-green">{SITE.wordmark.tail}</span>
            </p>
            <p className="mt-3 max-w-xs text-sm text-ink-soft">{SITE.description}</p>
          </div>
          <FooterCol
            title="Browse"
            links={[
              ["Towns", "/towns"],
              ["Categories", "/categories"],
              ["Verified", "/verified"],
            ]}
          />
          <FooterCol
            title="For business"
            links={[
              ["Add your business", "/portal/claim"],
              ["Claim a listing", "/portal/claim"],
              ["Premium", "/premium"],
            ]}
          />
          <FooterCol
            title="About"
            links={[
              ["Journal", "/journal"],
              ["How we check", "/about"],
              ["Contact", "/contact"],
            ]}
          />
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.name}. A {SITE.county} directory.
          </p>
          <p className="font-data">Listing data confirmed by owners.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-data text-xs uppercase tracking-wide text-ink-soft">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-ink hover:text-green">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
