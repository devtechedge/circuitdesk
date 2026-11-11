import type { Metadata } from "next";
import { requirePageSession } from "@/auth/page-auth";
import { CatalogManager } from "@/components/catalog-manager";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { formatMoneyMinor } from "@/domain/money";
import { hasPermission } from "@/security/rbac";
import { listCatalogOverview } from "@/services/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Products & Warranty Policies",
};

export default async function ProductsAndPoliciesPage() {
  const session = await requirePageSession("console:read");
  const catalog = await listCatalogOverview(session);
  const skuById = new Map(catalog.products.map((p) => [p.id, p.sku]));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Catalog & Coverage Rules"
        title="Hardware SKUs & Warranty Policies"
        description="Define serialized products, HSN codes, replacement costs, and channel/region coverage matrices."
      />

      <CatalogManager
        brands={catalog.brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug }))}
        products={catalog.products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))}
        canWrite={hasPermission(session.role, "catalog:write")}
      />

      <section className="space-y-3">
        <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
          Hardware Products ({catalog.products.length})
        </h2>
        <DataTableWrap label="Hardware products table">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">SKU</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">HSN</th>
                <th className="p-3">Unit Cost</th>
                <th className="p-3">Retail Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {catalog.products.map((p) => (
                <tr key={p.id}>
                  <td className="p-3">
                    <TechCode>{p.sku}</TechCode>
                  </td>
                  <td className="p-3 font-medium text-[var(--text-primary)]">{p.name}</td>
                  <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                    {p.category}
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-muted)]">{p.hsnCode}</td>
                  <td className="p-3 font-mono text-xs">
                    {formatMoneyMinor(p.unitCostMinor, p.currency)}
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {formatMoneyMinor(p.retailPriceMinor, p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableWrap>
      </section>

      <section className="space-y-3">
        <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
          Warranty Policies ({catalog.policies.length})
        </h2>
        <DataTableWrap label="Warranty policies table">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">SKU</th>
                <th className="p-3">Policy Name</th>
                <th className="p-3">Region / Channel</th>
                <th className="p-3">Term</th>
                <th className="p-3">DOA</th>
                <th className="p-3">Offline Gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {catalog.policies.map((pol) => (
                <tr key={pol.id}>
                  <td className="p-3">
                    <TechCode>{skuById.get(pol.productId) ?? "-"}</TechCode>
                  </td>
                  <td className="p-3 font-medium text-[var(--text-primary)]">{pol.name}</td>
                  <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                    {pol.regionCode} &middot; {pol.salesChannel}
                  </td>
                  <td className="p-3 font-mono text-xs">{pol.durationMonths}m</td>
                  <td className="p-3 font-mono text-xs">{pol.doaWindowDays}d</td>
                  <td className="p-3">
                    <StatusBadge tone={pol.offlineReviewRequired ? "info" : "neutral"}>
                      {pol.offlineReviewRequired ? "Review Required" : "Auto"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableWrap>
      </section>
    </div>
  );
}
