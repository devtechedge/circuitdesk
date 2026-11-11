import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSession } from "@/auth/page-auth";
import { PrintButton } from "@/components/print-button";
import { SectionHeader, TechCode } from "@/components/ui/primitives";
import { renderRegistrationQrSvg } from "@/domain/qr-svg";
import { getEnv } from "@/env";
import { listCatalogOverview } from "@/services/catalog";
import { listBatchesAndSerials } from "@/services/serials";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Printable Packaging QR Labels",
};

export default async function PrintableQrLabelsPage() {
  const session = await requirePageSession("serial:unmask");
  const [catalog, serialData] = await Promise.all([
    listCatalogOverview(session),
    listBatchesAndSerials(session, { limit: 12 }),
  ]);

  const primaryBrand = catalog.brands[0];
  const baseUrl = getEnv().APP_URL;

  const cards = await Promise.all(
    serialData.serials.slice(0, 9).map(async (s) => {
      const qr = await renderRegistrationQrSvg({
        baseUrl,
        brandSlug: primaryBrand?.slug ?? "brand",
        serialNumber: s.serialDisplay,
        sku: s.sku,
        size: 108,
      });
      return {
        ...s,
        ...qr,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="no-print">
        <SectionHeader
          eyebrow="Packaging & Box Inserts"
          title="Printable QR Warranty Label Sheet"
          description="Print onto A4 / thermal adhesive stock or save as PDF. Scanning opens /w/[brand]/register with SKU and serial pre-populated."
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/app/serials"
                className="inline-flex h-9 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] no-underline"
              >
                &larr; Back to Serials
              </Link>
              <PrintButton label="Print QR Label Sheet / PDF" />
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.id}
            className="print-card cd-surface rounded-lg p-4 flex items-center gap-3.5"
          >
            <div
              className="rounded border border-[var(--border-subtle)] bg-white p-1.5 shrink-0"
              dangerouslySetInnerHTML={{ __html: c.svgMarkup }}
            />
            <div className="min-w-0 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] truncate">
                {primaryBrand?.name ?? "Hardware Warranty"}
              </div>
              <TechCode className="block truncate">{c.sku}</TechCode>
              <div className="font-mono text-[11px] text-[var(--text-secondary)] truncate">
                S/N: {c.serialDisplay}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                Scan to activate warranty
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
