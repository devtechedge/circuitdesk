import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AlertBanner, StatusBadge, TechCode } from "@/components/ui/primitives";
import { getGuideBySlug } from "@/content/guides";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return { title: "Guide" };
  return {
    title: guide.title,
    description: guide.summary,
  };
}

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-3xl flex-1 px-4 py-12 sm:px-6 space-y-8">
        <div>
          <Link
            href="/guides"
            className="font-mono text-xs text-[var(--signal-cobalt)] hover:underline"
          >
            &larr; All operations guides
          </Link>
        </div>

        <article className="space-y-6">
          <header className="space-y-3 border-b border-[var(--border-subtle)] pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="info">{guide.category}</StatusBadge>
              <TechCode>{guide.readMinutes} min read</TechCode>
              <span className="font-mono text-xs text-[var(--text-muted)]">
                Published {guide.publishedIso}
              </span>
            </div>
            <h1 className="m-0 text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] leading-tight">
              {guide.title}
            </h1>
            <p className="m-0 text-base text-[var(--text-secondary)]">{guide.summary}</p>
          </header>

          {guide.sections.map((sec) => (
            <section key={sec.heading} className="space-y-3">
              <h2 className="m-0 text-lg font-bold text-[var(--text-primary)]">{sec.heading}</h2>
              {sec.paragraphs.map((p) => (
                <p key={p} className="m-0 text-sm sm:text-base leading-relaxed text-[var(--text-secondary)]">
                  {p}
                </p>
              ))}
            </section>
          ))}

          <AlertBanner tone="neutral" title="Operational Engineering Reference">
            Regulatory and tax references summarize public circulars for workflow design; consult
            your chartered accountant or legal counsel for entity-specific filings.
          </AlertBanner>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
