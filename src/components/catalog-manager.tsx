"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  FAULT_CATEGORIES,
  type FaultCategory,
  PRODUCT_CATEGORIES,
  type ProductCategory,
  type SalesChannel,
} from "@/db/schema";
import { AlertBanner } from "./ui/primitives";

export function CatalogManager({
  brands,
  products,
  canWrite,
}: {
  brands: Array<{ id: string; name: string; slug: string }>;
  products: Array<{ id: string; sku: string; name: string }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"product" | "policy">("product");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // SKU form state
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [sku, setSku] = useState("");
  const [prodName, setProdName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("AUDIO");
  const [hsnCode, setHsnCode] = useState("85183000");
  const [unitCostMajor, setUnitCostMajor] = useState("1500");
  const [retailMajor, setRetailMajor] = useState("4999");

  // Policy form state
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [policyName, setPolicyName] = useState("India 12-Month Standard Warranty");
  const [regionCode, setRegionCode] = useState("IN");
  const [salesChannel, setSalesChannel] = useState<SalesChannel>("ALL");
  const [durationMonths, setDurationMonths] = useState(12);
  const [doaWindowDays, setDoaWindowDays] = useState(7);
  const [repairExtensionMonths, setRepairExtensionMonths] = useState(0);
  const [exclusionsNote, setExclusionsNote] = useState(
    "Excludes liquid ingress, unauthorized modification, and accidental drop damage."
  );

  if (!canWrite) {
    return (
      <AlertBanner tone="neutral" title="Read-Only Catalog View">
        Your role does not permit creating SKUs or modifying warranty policies.
      </AlertBanner>
    );
  }

  async function submitProduct(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/app/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "product",
          payload: {
            brandId,
            sku,
            name: prodName,
            category,
            hsnCode,
            unitCostMinor: Math.round(Number(unitCostMajor) * 100),
            retailPriceMinor: Math.round(Number(retailMajor) * 100),
          },
        }),
      });
      const data = (await res.json()) as {
        product?: { id: string; sku: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to create SKU.");
        setBusy(false);
        return;
      }
      setNotice(`Added SKU ${data.product?.sku}.`);
      if (data.product?.id) setProductId(data.product.id);
      setSku("");
      setProdName("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error saving SKU.");
      setBusy(false);
    }
  }

  async function submitPolicy(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const coveredFaults: FaultCategory[] = [
        "DOA",
        "BATTERY",
        "CHARGING",
        "CONNECTIVITY",
        "SOFTWARE_FIRMWARE",
      ];
      const res = await fetch("/api/app/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "policy",
          payload: {
            productId,
            name: policyName,
            regionCode,
            salesChannel,
            durationMonths: Number(durationMonths),
            doaWindowDays: Number(doaWindowDays),
            repairExtensionMonths: Number(repairExtensionMonths),
            requiresReceipt: true,
            offlineReviewRequired: true,
            coveredFaults,
            exclusionsNote,
            replaceCostThresholdMinor: 150000,
          },
        }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to create warranty policy.");
        setBusy(false);
        return;
      }
      setNotice("Saved warranty policy.");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error saving policy.");
      setBusy(false);
    }
  }

  return (
    <div className="cd-surface rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("product")}
          className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold cursor-pointer ${
            tab === "product"
              ? "bg-[var(--signal-orange)] text-[var(--on-signal)]"
              : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
          }`}
        >
          + New Hardware SKU
        </button>
        <button
          type="button"
          onClick={() => setTab("policy")}
          data-testid="tab-new-policy"
          className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold cursor-pointer ${
            tab === "policy"
              ? "bg-[var(--signal-orange)] text-[var(--on-signal)]"
              : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
          }`}
        >
          + New Warranty Policy
        </button>
      </div>

      {error && (
        <AlertBanner tone="danger" title="Catalog Error">
          {error}
        </AlertBanner>
      )}
      {notice && (
        <AlertBanner tone="ok" title="Saved">
          {notice}
        </AlertBanner>
      )}

      {tab === "product" ? (
        <form onSubmit={submitProduct} data-testid="create-product-form" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="sku-brand" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Brand
            </label>
            <select
              id="sku-brand"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (/w/{b.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sku-code" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              SKU Code
            </label>
            <input
              id="sku-code"
              required
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="KNX-BUDS-LITE"
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label htmlFor="sku-name" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Product Name
            </label>
            <input
              id="sku-name"
              required
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              placeholder="Kinetix Buds Lite"
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label htmlFor="sku-cat" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Category
            </label>
            <select
              id="sku-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sku-hsn" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              HSN Code
            </label>
            <input
              id="sku-hsn"
              required
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="sku-cost" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Unit Cost
              </label>
              <input
                id="sku-cost"
                type="number"
                min={0}
                required
                value={unitCostMajor}
                onChange={(e) => setUnitCostMajor(e.target.value)}
                className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label htmlFor="sku-mrp" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Retail Price
              </label>
              <input
                id="sku-mrp"
                type="number"
                min={0}
                required
                value={retailMajor}
                onChange={(e) => setRetailMajor(e.target.value)}
                className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] cursor-pointer disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save Hardware SKU"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitPolicy} data-testid="create-policy-form" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="pol-prod" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Target SKU
            </label>
            <select
              id="pol-prod"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pol-name" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Policy Name
            </label>
            <input
              id="pol-name"
              required
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="pol-reg" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Region
              </label>
              <input
                id="pol-reg"
                required
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value)}
                className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label htmlFor="pol-ch" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Channel
              </label>
              <select
                id="pol-ch"
                value={salesChannel}
                onChange={(e) => setSalesChannel(e.target.value as SalesChannel)}
                className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 text-xs text-[var(--text-primary)]"
              >
                <option value="ALL">ALL</option>
                <option value="D2C_WEB">D2C_WEB</option>
                <option value="MARKETPLACE">MARKETPLACE</option>
                <option value="OFFLINE_RETAIL">OFFLINE_RETAIL</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="pol-months" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Coverage (Months)
            </label>
            <input
              id="pol-months"
              type="number"
              min={1}
              max={120}
              value={durationMonths}
              onChange={(e) => setDurationMonths(Number(e.target.value))}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label htmlFor="pol-doa" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              DOA Window (Days)
            </label>
            <input
              id="pol-doa"
              type="number"
              min={0}
              max={90}
              value={doaWindowDays}
              onChange={(e) => setDoaWindowDays(Number(e.target.value))}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label htmlFor="pol-ext" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Repair Extension (Months)
            </label>
            <input
              id="pol-ext"
              type="number"
              min={0}
              max={24}
              value={repairExtensionMonths}
              onChange={(e) => setRepairExtensionMonths(Number(e.target.value))}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="pol-excl" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Exclusions Note (Shown on Customer Certificate · Covered: {FAULT_CATEGORIES.slice(0, 4).join(", ")})
            </label>
            <input
              id="pol-excl"
              required
              value={exclusionsNote}
              onChange={(e) => setExclusionsNote(e.target.value)}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={busy || products.length === 0}
              className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] cursor-pointer disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save Warranty Policy"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
