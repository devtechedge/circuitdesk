import type { Metadata } from "next";
import { requirePageSession } from "@/auth/page-auth";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { formatMoneyMinor } from "@/domain/money";
import { listServiceNetworkAndInventory } from "@/services/inventory";
import { listTenantRmas } from "@/services/rma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Spare Parts Inventory & RMAs",
};

export default async function InventoryAndRmasPage() {
  const session = await requirePageSession("console:read");
  const [inventory, rmas] = await Promise.all([
    listServiceNetworkAndInventory(session),
    listTenantRmas(session),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Parts & Reverse Logistics"
        title="Spare Parts Stock & RMA Dispositions"
        description="Monitor bench part stock, reorder thresholds, Return-to-Vendor supplier credits, and E-Waste manifests."
      />

      <section className="space-y-3">
        <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
          Bench Spare Parts ({inventory.parts.length})
        </h2>
        <DataTableWrap label="Spare parts stock table">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">Part SKU</th>
                <th className="p-3">Component</th>
                <th className="p-3">Service Bench</th>
                <th className="p-3">HSN</th>
                <th className="p-3">Unit Cost</th>
                <th className="p-3">On Hand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {inventory.parts.map((row) => {
                const low = row.part.quantityOnHand <= row.part.reorderThreshold;
                return (
                  <tr key={row.part.id}>
                    <td className="p-3">
                      <TechCode>{row.part.partSku}</TechCode>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-[var(--text-primary)]">{row.part.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Supplier: {row.part.supplierName}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                      {row.centreCode}
                    </td>
                    <td className="p-3 font-mono text-xs text-[var(--text-muted)]">
                      {row.part.hsnCode}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {formatMoneyMinor(row.part.unitCostMinor, session.tenantCurrency)}
                    </td>
                    <td className="p-3">
                      <StatusBadge tone={low ? "danger" : "ok"}>
                        {row.part.quantityOnHand} (min {row.part.reorderThreshold})
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableWrap>
      </section>

      <section className="space-y-3">
        <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
          RMA Orders &amp; Hardware Dispositions ({rmas.length})
        </h2>
        <DataTableWrap label="RMA orders table">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">RMA</th>
                <th className="p-3">Claim</th>
                <th className="p-3">Direction &amp; Carrier</th>
                <th className="p-3">Disposition</th>
                <th className="p-3">Supplier Recovery</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {rmas.map(({ rma, claimNumber }) => (
                <tr key={rma.id}>
                  <td className="p-3">
                    <TechCode>{rma.rmaNumber}</TechCode>
                  </td>
                  <td className="p-3 font-mono text-xs">{claimNumber}</td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">
                    <div>{rma.direction}</div>
                    <div className="font-mono text-[11px] text-[var(--text-muted)]">
                      {rma.carrierMode} &middot; {rma.carrierName}
                    </div>
                  </td>
                  <td className="p-3">
                    <TechCode>{rma.disposition}</TechCode>
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {formatMoneyMinor(rma.supplierRecoveryMinor, session.tenantCurrency)}
                  </td>
                  <td className="p-3">
                    <StatusBadge tone={rma.status === "CLOSED" ? "ok" : "info"}>
                      {rma.status}
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
