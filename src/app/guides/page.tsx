import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { OPERATIONS_GUIDES } from "@/content/guides";

export const metadata: Metadata = {
  title: "Hardware Warranty & After-Sales Operations Guides",
  description:
    "Technical guides on Indian electronics warranty GST (CBIC 195/2023), serial and batch defect lineage, Shopify claims architecture, and PIN-code repair routing.",
};

export default function GuidesIndexPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6 space-y-8">
        <SectionHeader
          eyebrow="Operations Playbooks"
          title="Practical guides for electronics after-sales teams"
          description="Original engineering and compliance notes on serialized warranty operations, supplier batch quality, and Indian GST accounting."
        />

        <div className="grid grid-cols-1 gap-4">
          {OPERATIONS_GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="cd-surface rounded-xl p-5 sm:p-6 space-y-2.5 hover:border-[var(--border-strong)] transition-colors no-underline"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="info">{guide.category}</StatusBadge>
                <TechCode>{guide.readMinutes} min read</TechCode>
                <span className="font-mono text-xs text-[var(--text-muted)]">
                  {guide.publishedIso}
                </span>
              </div>
              <h2 className="m-0 text-lg font-bold text-[var(--text-primary)]">{guide.title}</h2>
              <p className="m-0 text-sm text-[var(--text-secondary)] leading-relaxed">
                {guide.summary}
              </p>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
