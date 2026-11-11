import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { ThemeToggle } from "./theme-toggle";

const PUBLIC_NAV = [
  { href: "/features", label: "Features" },
  { href: "/solutions/audio-wearables", label: "Verticals" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Interactive Demo" },
  { href: "/guides", label: "Guides" },
  { href: "/integrations", label: "Integrations" },
  { href: "/security", label: "Security" },
] as const;

export function SiteHeader() {
  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6 min-w-0">
          <BrandMark />
          <nav
            aria-label="Primary"
            className="hidden lg:flex items-center gap-5 text-sm text-[var(--text-secondary)]"
          >
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-[var(--text-primary)] transition-colors no-underline"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)] no-underline"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-3.5 text-xs font-semibold text-[var(--on-signal)] hover:opacity-95 no-underline"
          >
            Start workspace
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* Compact mobile sub-nav without horizontal overflow */}
      <nav
        aria-label="Mobile sections"
        className="flex lg:hidden flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)]"
      >
        {PUBLIC_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="hover:text-[var(--text-primary)] no-underline"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
