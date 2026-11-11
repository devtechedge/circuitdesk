import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { StatusBadge } from "@/components/ui/primitives";
import { getDb } from "@/db/client";
import { seedSyntheticDemo } from "@/demo/seed";
import { isDemoMode } from "@/env";
import { getBrandPortalContext } from "@/services/registrations";

export const dynamic = "force-dynamic";

export default async function BrandPortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  if (isDemoMode() && brand.toLowerCase() === "kinetix") {
    await seedSyntheticDemo(await getDb());
  }

  const portal = await getBrandPortalContext(brand);
  if (!portal) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)]">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] no-print">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: portal.brand.accentHex }}
            />
            <Link
              href={`/w/${portal.brand.slug}`}
              className="text-base font-bold tracking-tight text-[var(--text-primary)] no-underline truncate"
            >
              {portal.brand.name} Warranty Desk
            </Link>
            {portal.tenantIsDemo && <StatusBadge tone="warn">Synthetic Demo</StatusBadge>}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href={`/w/${portal.brand.slug}/register`}
              className="inline-flex h-9 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] no-underline"
            >
              Register Product
            </Link>
            <Link
              href={`/w/${portal.brand.slug}/claim`}
              className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-3 text-xs font-semibold text-[var(--on-signal)] no-underline"
            >
              File Claim
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-5 no-print">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-[var(--text-muted)] sm:px-6">
          <span>
            Support: {portal.brand.supportEmail} &middot; Zero-account token-scoped warranty portal
          </span>
          {!portal.brand.hideCircuitdeskBadge && (
            <Link
              href="/"
              className="font-mono text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline"
            >
              Protected with CircuitDesk &rarr;
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}
