import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-28 text-center sm:px-8">
      <p className="font-data text-xs uppercase tracking-widest text-green">
        Not found
      </p>
      <h1 className="mt-3 text-5xl text-ink">Nothing here yet.</h1>
      <p className="mt-4 text-lg text-ink-soft">
        This page isn&apos;t part of the directory — or hasn&apos;t been written
        up yet.
      </p>
      <Link href="/" className="link-underline mt-8 inline-block text-green">
        ← Back to the directory
      </Link>
    </div>
  );
}
