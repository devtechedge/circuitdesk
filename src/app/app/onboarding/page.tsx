import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSession } from "@/auth/page-auth";
import { SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { getOnboardingStatus } from "@/services/onboarding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace Onboarding & Activation",
};

export default async function OnboardingPage() {
  const session = await requirePageSession("console:read");
  const status = await getOnboardingStatus(session);
  const pct = Math.round((status.completedCount / Math.max(status.totalCount, 1)) * 100);

  return (
    <div data-testid="onboarding-page" className="space-y-6">
      <SectionHeader
        eyebrow="6-Step Rollout"
        title="Workspace Activation Checklist"
        description="Complete each step to launch your branded registration portal, serial registry, and service routing."
        actions={
          <StatusBadge tone={pct === 100 ? "ok" : "info"}>
            {status.completedCount}/{status.totalCount} Completed ({pct}%)
          </StatusBadge>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {status.steps.map((step) => (
          <div
            key={step.key}
            className="cd-surface rounded-xl p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <TechCode>{step.key.toUpperCase()}</TechCode>
                <StatusBadge tone={step.completed ? "ok" : "warn"}>
                  {step.completed ? "Done" : "Pending"}
                </StatusBadge>
              </div>
              <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">{step.title}</h2>
              <p className="m-0 text-xs leading-relaxed text-[var(--text-secondary)]">
                {step.description}
              </p>
            </div>

            <div>
              <Link
                href={step.href}
                className="inline-flex h-9 items-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--signal-orange)] no-underline"
              >
                Open workspace step &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>

      <section className="cd-elevated rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            CSV Import Templates &amp; Packaging QR Sheets
          </h2>
          <p className="m-0 text-xs text-[var(--text-secondary)]">
            Download the standard serial CSV schema or print packaging QR inserts for existing serials.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/api/app/serials?template=1"
            download="circuitdesk-serials-template.csv"
            className="inline-flex h-9 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-primary)] no-underline"
          >
            Download Serial CSV Template
          </a>
          <Link
            href="/app/serials/labels"
            className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-3.5 text-xs font-semibold text-[var(--on-signal)] no-underline"
          >
            Open Printable QR Label Sheet
          </Link>
        </div>
      </section>
    </div>
  );
}
