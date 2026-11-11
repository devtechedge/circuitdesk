"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { Role } from "@/db/schema";
import { BrandMark } from "./brand-mark";
import { ThemeToggle } from "./theme-toggle";
import { StatusBadge, TechCode } from "./ui/primitives";

const CONSOLE_NAV = [
  { href: "/app", label: "Overview" },
  { href: "/app/onboarding", label: "Onboarding" },
  { href: "/app/products", label: "Products & Policies" },
  { href: "/app/serials", label: "Serials & Batches" },
  { href: "/app/registrations", label: "Registrations" },
  { href: "/app/claims", label: "Claims Triage" },
  { href: "/app/repairs", label: "Repair Bench" },
  { href: "/app/inventory", label: "Inventory & RMAs" },
  { href: "/app/service-network", label: "Service Network" },
  { href: "/app/analytics", label: "Analytics & GST" },
  { href: "/app/automations", label: "Automations" },
  { href: "/app/integrations", label: "Integrations" },
  { href: "/app/team", label: "Team & RBAC" },
  { href: "/app/settings", label: "Settings & Privacy" },
  { href: "/app/billing", label: "Billing & Quotas" },
  { href: "/app/audit", label: "Audit Log" },
] as const;

export function AppShell({
  tenantName,
  isDemoTenant,
  userFullName,
  role,
  planName,
  regUsed,
  regLimit,
  claimUsed,
  claimLimit,
  children,
}: {
  tenantName: string;
  isDemoTenant: boolean;
  userFullName: string;
  role: Role;
  planName: string;
  regUsed: number;
  regLimit: number;
  claimUsed: number;
  claimLimit: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)]">
      {/* Top Console Header */}
      <header
        data-testid="console-header"
        className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] no-print"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <BrandMark href="/app" compact />
            <span className="text-sm font-bold text-[var(--text-primary)] truncate max-w-[220px] sm:max-w-xs">
              {tenantName}
            </span>
            {isDemoTenant && <StatusBadge tone="warn">Synthetic Demo</StatusBadge>}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="hidden md:inline font-mono text-xs text-[var(--text-muted)]">
              {userFullName}
            </span>
            <TechCode>{role}</TechCode>
            <button
              type="button"
              onClick={handleLogout}
              data-testid="logout-button"
              className="inline-flex h-9 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)] cursor-pointer"
            >
              Sign out
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile wrapping nav */}
        <nav
          aria-label="Console mobile navigation"
          className="flex lg:hidden flex-wrap gap-1.5 border-t border-[var(--border-subtle)] px-4 py-2"
        >
          {CONSOLE_NAV.map((item) => {
            const active =
              item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-2 py-1 text-[11px] font-medium no-underline ${
                  active
                    ? "bg-[var(--signal-orange)] text-[var(--on-signal)]"
                    : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="flex flex-1 min-w-0">
        {/* Desktop Sidebar */}
        <aside
          aria-label="Console sidebar"
          className="hidden lg:flex w-60 shrink-0 flex-col justify-between border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 no-print"
        >
          <nav aria-label="Workspace modules" className="space-y-1">
            {CONSOLE_NAV.map((item) => {
              const active =
                item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors no-underline ${
                    active
                      ? "bg-[var(--bg-elevated)] text-[var(--signal-orange)] border border-[var(--border-strong)] font-semibold"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Monthly Plan Usage Meter */}
          <div className="mt-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono uppercase text-[var(--text-muted)]">Plan Meter</span>
              <TechCode>{planName}</TechCode>
            </div>
            <div>
              <div className="flex justify-between font-mono text-[11px] text-[var(--text-secondary)]">
                <span>Registrations</span>
                <span>
                  {regUsed}/{regLimit}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--bg-muted)] overflow-hidden">
                <div
                  className="h-full bg-[var(--signal-cobalt)]"
                  style={{ width: `${Math.min(100, Math.round((regUsed / Math.max(regLimit, 1)) * 100))}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between font-mono text-[11px] text-[var(--text-secondary)]">
                <span>Claims</span>
                <span>
                  {claimUsed}/{claimLimit}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--bg-muted)] overflow-hidden">
                <div
                  className="h-full bg-[var(--signal-orange)]"
                  style={{ width: `${Math.min(100, Math.round((claimUsed / Math.max(claimLimit, 1)) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </aside>

        <main id="main-content" className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
