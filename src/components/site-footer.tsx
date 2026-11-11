import Link from "next/link";
import { BrandMark } from "./brand-mark";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <BrandMark />
            <p className="m-0 text-sm text-[var(--text-muted)]">
              Every product has an afterlife. Manage it beautifully. Built for electronics,
              audio, wearable, accessory, and appliance brands.
            </p>
            <p className="m-0 font-mono text-xs text-[var(--text-muted)]">
              India-first (PIN zones, GST 195/2023, DPDP) &middot; Global-ready
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="m-0 font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Platform
            </h2>
            <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
              <li>
                <Link href="/features" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Product &amp; Policies
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Pricing &amp; Overages
                </Link>
              </li>
              <li>
                <Link href="/demo" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Synthetic Demo Sandbox
                </Link>
              </li>
              <li>
                <Link href="/integrations" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Connectors &amp; CSV Sync
                </Link>
              </li>
              <li>
                <Link href="/w/kinetix/register" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Sample Branded Portal (/w/kinetix)
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="m-0 font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Verticals &amp; Guides
            </h2>
            <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
              <li>
                <Link href="/solutions/audio-wearables" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Audio &amp; Wearables
                </Link>
              </li>
              <li>
                <Link href="/solutions/smart-appliances" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Smart Home &amp; Appliances
                </Link>
              </li>
              <li>
                <Link href="/solutions/mobile-accessories" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  GaN Chargers &amp; Accessories
                </Link>
              </li>
              <li>
                <Link href="/guides" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  After-Sales Operations Guides
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="m-0 font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Trust &amp; Legal
            </h2>
            <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
              <li>
                <Link href="/security" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Multi-Tenant Security
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  About CircuitDesk
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Contact &amp; Migration Help
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Privacy Notice (Draft)
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Terms of Service (Draft)
                </Link>
              </li>
              <li>
                <Link href="/dpa" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline">
                  Data Processing Addendum (Draft)
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-6 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; 2026 CircuitDesk. MIT Licensed Open Source Software.</span>
          <span>
            Legal pages are operational templates requiring counsel review before live commercial contracts.
          </span>
        </div>
      </div>
    </footer>
  );
}
