import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto flex max-w-2xl flex-1 flex-col justify-center px-4 py-16 text-center">
        <p className="m-0 font-mono text-xs uppercase tracking-widest text-[var(--signal-orange)]">
          HTTP 404 &middot; Resource Not Found
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
          This route, serial link, or portal token is unavailable
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          If you opened a warranty certificate or claim tracker link, the token may be mistyped,
          expired, or revoked by the brand operator.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-md bg-[var(--signal-orange)] px-4 text-sm font-semibold text-[var(--on-signal)] no-underline"
          >
            Return to CircuitDesk
          </Link>
          <Link
            href="/demo"
            className="inline-flex h-10 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--text-primary)] no-underline"
          >
            Open Interactive Demo
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
