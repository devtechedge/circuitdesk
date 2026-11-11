"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { SERIAL_CSV_TEMPLATE } from "@/domain/serial-csv";
import { AlertBanner, StatusBadge, TechCode } from "./ui/primitives";

export function SerialImporter({
  products,
  canWrite,
}: {
  products: Array<{ id: string; sku: string; name: string }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [csvText, setCsvText] = useState(SERIAL_CSV_TEMPLATE);
  const [preview, setPreview] = useState<{
    totalRows: number;
    validCount: number;
    errors: Array<{ rowNumber: number; serialNumber: string; reason: string }>;
    importedCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Batch creation state
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [batchCode, setBatchCode] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [factoryCode, setFactoryCode] = useState("IN-SMT-01");
  const [manufacturedAt, setManufacturedAt] = useState("2026-11-01");

  if (!canWrite) {
    return (
      <AlertBanner tone="neutral" title="Masked / Read-Only Registry">
        Your role displays masked serial numbers and does not permit CSV imports or batch edits.
      </AlertBanner>
    );
  }

  async function runCsv(dryRun: boolean) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/app/serials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "csv", csvText, dryRun }),
      });
      const data = (await res.json()) as {
        totalRows?: number;
        validRows?: unknown[];
        errors?: Array<{ rowNumber: number; serialNumber: string; reason: string }>;
        importedCount?: number;
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "CSV validation failed.");
        setBusy(false);
        return;
      }
      setPreview({
        totalRows: data.totalRows ?? 0,
        validCount: data.validRows?.length ?? 0,
        errors: data.errors ?? [],
        importedCount: data.importedCount ?? 0,
      });
      setBusy(false);
      if (!dryRun) router.refresh();
    } catch {
      setError("Network error processing CSV.");
      setBusy(false);
    }
  }

  async function submitBatch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/app/serials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "batch",
          payload: {
            productId,
            batchCode,
            lotNumber,
            supplierName,
            factoryCode,
            manufacturedAt,
            notes: "",
          },
        }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Could not create batch.");
        setBusy(false);
        return;
      }
      setBatchCode("");
      setLotNumber("");
      setSupplierName("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error saving batch.");
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* CSV Dry-Run + Commit */}
      <div className="xl:col-span-7 cd-surface rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
              CSV Serial &amp; IMEI Importer
            </h2>
            <p className="m-0 text-xs text-[var(--text-muted)]">
              Preview row-level SKU, duplicate-serial, 15-digit IMEI, and formula-injection checks before committing.
            </p>
          </div>
          <a
            href="/api/app/serials?template=1"
            download="circuitdesk-serials-template.csv"
            className="font-mono text-xs text-[var(--signal-cobalt)] hover:underline"
          >
            Download CSV template
          </a>
        </div>

        {error && (
          <AlertBanner tone="danger" title="Import Error">
            {error}
          </AlertBanner>
        )}

        <div>
          <label htmlFor="serial-csv-input" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            CSV Payload (sku,serial_number,imei,batch_code,sales_channel,external_order_id,sold_at)
          </label>
          <textarea
            id="serial-csv-input"
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 font-mono text-xs text-[var(--text-primary)]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => runCsv(true)}
            data-testid="csv-preview-btn"
            className="inline-flex h-9 items-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 text-xs font-semibold text-[var(--text-primary)] cursor-pointer disabled:opacity-60"
          >
            1. Dry-Run Preview
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runCsv(false)}
            data-testid="csv-commit-btn"
            className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-3.5 text-xs font-semibold text-[var(--on-signal)] cursor-pointer disabled:opacity-60"
          >
            2. Commit Valid Serials
          </button>
        </div>

        {preview && (
          <div data-testid="csv-preview-result" className="cd-elevated rounded-lg p-3.5 space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="ok">{preview.validCount} Valid Row(s)</StatusBadge>
              <StatusBadge tone={preview.errors.length > 0 ? "danger" : "neutral"}>
                {preview.errors.length} Rejected Row(s)
              </StatusBadge>
              {preview.importedCount > 0 && (
                <StatusBadge tone="info">{preview.importedCount} Committed to DB</StatusBadge>
              )}
            </div>

            {preview.errors.length > 0 && (
              <ul className="m-0 list-disc pl-5 space-y-1 text-[var(--status-danger-fg)]">
                {preview.errors.slice(0, 8).map((err) => (
                  <li key={`${err.rowNumber}-${err.serialNumber}`}>
                    Row {err.rowNumber} (<TechCode>{err.serialNumber}</TechCode>): {err.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Register Supplier / Factory Batch */}
      <form
        onSubmit={submitBatch}
        className="xl:col-span-5 cd-surface rounded-xl p-5 space-y-3"
      >
        <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
          Register Supplier / Factory Batch
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="b-prod" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Product SKU
            </label>
            <select
              id="b-prod"
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
            <label htmlFor="b-code" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Batch Code
            </label>
            <input
              id="b-code"
              required
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              placeholder="BATCH-KNX-2026-Q4A"
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label htmlFor="b-lot" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Supplier Lot
            </label>
            <input
              id="b-lot"
              required
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder="LOT-9901"
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label htmlFor="b-sup" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Supplier Name
            </label>
            <input
              id="b-sup"
              required
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Pune Power Systems LLP"
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label htmlFor="b-fac" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Factory Code
            </label>
            <input
              id="b-fac"
              required
              value={factoryCode}
              onChange={(e) => setFactoryCode(e.target.value)}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="b-date" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Manufactured Date
            </label>
            <input
              id="b-date"
              type="date"
              required
              value={manufacturedAt}
              onChange={(e) => setManufacturedAt(e.target.value)}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || products.length === 0}
          className="inline-flex h-9 items-center rounded-md bg-[var(--signal-cobalt)] px-4 text-xs font-semibold text-[var(--on-cobalt)] cursor-pointer disabled:opacity-60"
        >
          Save Production Batch
        </button>
      </form>
    </div>
  );
}
