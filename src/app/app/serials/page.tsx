import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSession } from "@/auth/page-auth";
import { SerialImporter } from "@/components/serial-importer";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { hasPermission } from "@/security/rbac";
import { listBatchesAndSerials } from "@/services/serials";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Serial, IMEI & Batch Registry",
};

export default async function SerialsPage() {
  const session = await requirePageSession("console:read");
  const data = await listBatchesAndSerials(session);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Serialized Lineage"
        title="Serial, IMEI & Supplier Batch Registry"
        description="Import serialized hardware with CSV dry-run validation, link units to factory lots, and print scannable box QR inserts."
        actions={
          <Link
            href="/app/serials/labels"
            className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-3.5 text-xs font-semibold text-[var(--on-signal)] no-underline"
          >
            Print QR Label Sheet
          </Link>
        }
      />

      <SerialImporter
        products={data.products}
        canWrite={hasPermission(session.role, "serials:write")}
      />

      {/* Batches */}
      <section className="space-y-3">
        <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
          Production Batches ({data.batches.length})
        </h2>
        <DataTableWrap label="Production batches table">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">Batch Code</th>
                <th className="p-3">Lot</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Factory</th>
                <th className="p-3">Units</th>
                <th className="p-3">Mfg Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {data.batches.map((b) => (
                <tr key={b.id}>
                  <td className="p-3">
                    <TechCode>{b.batchCode}</TechCode>
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                    {b.lotNumber}
                  </td>
                  <td className="p-3 text-[var(--text-primary)]">{b.supplierName}</td>
                  <td className="p-3 font-mono text-xs text-[var(--text-muted)]">
                    {b.factoryCode}
                  </td>
                  <td className="p-3 font-mono text-xs">{b.unitCount}</td>
                  <td className="p-3 font-mono text-xs text-[var(--text-muted)]">
                    {b.manufacturedAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableWrap>
      </section>

      {/* Serialized Units */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            Serialized Units ({data.serials.length})
          </h2>
          <StatusBadge tone={data.canUnmask ? "info" : "neutral"}>
            {data.canUnmask ? "Unmasked Operator View" : "RBAC Masked Serial View"}
          </StatusBadge>
        </div>

        <DataTableWrap label="Serialized hardware units table">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">Serial Number</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Batch</th>
                <th className="p-3">IMEI</th>
                <th className="p-3">Channel / Order</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {data.serials.map((s) => (
                <tr key={s.id}>
                  <td className="p-3">
                    <TechCode>{s.serialDisplay}</TechCode>
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-primary)]">{s.sku}</td>
                  <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                    {s.batchCode ?? "-"}
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-muted)]">
                    {s.imeiDisplay ?? "-"}
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                    {s.salesChannel}
                    {s.externalOrderId ? ` · ${s.externalOrderId}` : ""}
                  </td>
                  <td className="p-3">
                    <StatusBadge
                      tone={
                        s.status === "REGISTERED"
                          ? "ok"
                          : s.status === "CLAIMED"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {s.status}
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
