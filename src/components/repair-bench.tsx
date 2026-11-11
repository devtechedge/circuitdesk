"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { PRODUCT_CATEGORIES, type ProductCategory, REPAIR_STAGES, type RepairStage } from "@/db/schema";
import { AlertBanner } from "./ui/primitives";

export function RepairBenchForm({
  repairId,
  initialStage,
  initialDiagnosis,
  initialNotes,
  initialChecklist,
  initialLabourMinor,
  initialFreightMinor,
  initialCarrier,
  initialTracking,
  centreParts,
  canExecute,
}: {
  repairId: string;
  initialStage: RepairStage;
  initialDiagnosis: string;
  initialNotes: string;
  initialChecklist: {
    powerOn: boolean;
    chargeTest: boolean;
    burnIn: boolean;
    enclosureSeal: boolean;
  };
  initialLabourMinor: number;
  initialFreightMinor: number;
  initialCarrier: string;
  initialTracking: string;
  centreParts: Array<{ id: string; partSku: string; name: string; quantityOnHand: number }>;
  canExecute: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<RepairStage>(initialStage);
  const [diagnosisCode, setDiagnosisCode] = useState(initialDiagnosis);
  const [inspectionNotes, setInspectionNotes] = useState(initialNotes);
  const [checklist, setChecklist] = useState(initialChecklist);
  const [labourMajor, setLabourMajor] = useState(String(initialLabourMinor / 100));
  const [freightMajor, setFreightMajor] = useState(String(initialFreightMinor / 100));
  const [returnCarrier, setReturnCarrier] = useState(initialCarrier);
  const [returnTrackingNumber, setReturnTrackingNumber] = useState(initialTracking);

  const [selectedPartId, setSelectedPartId] = useState(centreParts[0]?.id ?? "");
  const [partQty, setPartQty] = useState(1);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!canExecute) {
    return (
      <AlertBanner tone="neutral" title="Read-Only Bench View">
        Only Operations, Owner, Admin, and assigned Technicians can update bench stages or consume spare parts.
      </AlertBanner>
    );
  }

  async function saveStage(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/app/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "stage",
          repairId,
          payload: {
            stage,
            inspectionNotes,
            diagnosisCode,
            qaChecklist: checklist,
            labourCostMinor: Math.round(Number(labourMajor) * 100),
            freightCostMinor: Math.round(Number(freightMajor) * 100),
            returnCarrier: returnCarrier || undefined,
            returnTrackingNumber: returnTrackingNumber || undefined,
          },
        }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to update bench stage.");
        setBusy(false);
        return;
      }
      setNotice(`Bench stage updated to ${stage}.`);
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error saving repair stage.");
      setBusy(false);
    }
  }

  async function consumePart(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/app/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "consume_part",
          repairId,
          payload: { sparePartId: selectedPartId, quantity: Number(partQty) },
        }),
      });
      const data = (await res.json()) as {
        remainingStock?: number;
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "Could not consume spare part.");
        setBusy(false);
        return;
      }
      setNotice(`Consumed part (${data.remainingStock} remaining in bench stock).`);
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error consuming part.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <AlertBanner tone="danger" title="Bench Error">
          {error}
        </AlertBanner>
      )}
      {notice && (
        <AlertBanner tone="ok" title="Bench Updated">
          {notice}
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={saveStage}
          data-testid="repair-stage-form"
          className="lg:col-span-8 cd-surface rounded-xl p-5 space-y-4"
        >
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            Mobile Technician Bench Controls &amp; QA Gate
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="rp-stage" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Repair Stage
              </label>
              <select
                id="rp-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as RepairStage)}
                className="h-10 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
              >
                {REPAIR_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rp-diag" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Diagnosis Code
              </label>
              <input
                id="rp-diag"
                required
                value={diagnosisCode}
                onChange={(e) => setDiagnosisCode(e.target.value)}
                className="h-10 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label htmlFor="rp-lab" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Bench Labour Cost
              </label>
              <input
                id="rp-lab"
                type="number"
                min={0}
                value={labourMajor}
                onChange={(e) => setLabourMajor(e.target.value)}
                className="h-10 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label htmlFor="rp-frt" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Outbound Freight Cost
              </label>
              <input
                id="rp-frt"
                type="number"
                min={0}
                value={freightMajor}
                onChange={(e) => setFreightMajor(e.target.value)}
                className="h-10 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label htmlFor="rp-car" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Return Carrier
              </label>
              <input
                id="rp-car"
                value={returnCarrier}
                onChange={(e) => setReturnCarrier(e.target.value)}
                placeholder="Blue Dart / Delhivery / Walk-in"
                className="h-10 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label htmlFor="rp-trk" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Return Tracking Number
              </label>
              <input
                id="rp-trk"
                value={returnTrackingNumber}
                onChange={(e) => setReturnTrackingNumber(e.target.value)}
                placeholder="BD-BOM-440199"
                className="h-10 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)]"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="rp-notes" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Inspection &amp; Bench Notes
              </label>
              <textarea
                id="rp-notes"
                rows={2}
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
                className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>

          <fieldset className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5">
            <legend className="px-1 font-mono text-xs uppercase text-[var(--signal-orange)]">
              Mandatory 4-Point QA Gate (Required for DISPATCHED)
            </legend>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
              {(
                [
                  ["powerOn", "1. Power-On"],
                  ["chargeTest", "2. Charge Probe"],
                  ["burnIn", "3. Load Burn-In"],
                  ["enclosureSeal", "4. Enclosure Seal"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist[key]}
                    onChange={(e) =>
                      setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[var(--signal-orange)]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={busy}
            data-testid="save-repair-stage-btn"
            className="inline-flex h-10 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] cursor-pointer disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save Stage & QA Checklist"}
          </button>
        </form>

        <form
          onSubmit={consumePart}
          data-testid="consume-part-form"
          className="lg:col-span-4 cd-surface rounded-xl p-5 space-y-3 self-start"
        >
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            Consume Bench Spare Part
          </h2>
          <p className="m-0 text-xs text-[var(--text-muted)]">
            Atomically decrements stock at this service centre and adds COGS to the repair order.
          </p>

          <div>
            <label htmlFor="cp-part" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Centre Spare Part
            </label>
            <select
              id="cp-part"
              value={selectedPartId}
              onChange={(e) => setSelectedPartId(e.target.value)}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
            >
              {centreParts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.partSku} ({p.quantityOnHand} on hand) - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cp-qty" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Quantity
            </label>
            <input
              id="cp-qty"
              type="number"
              min={1}
              max={20}
              value={partQty}
              onChange={(e) => setPartQty(Number(e.target.value))}
              className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
            />
          </div>

          <button
            type="submit"
            disabled={busy || centreParts.length === 0}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-[var(--signal-cobalt)] px-4 text-xs font-semibold text-[var(--on-cobalt)] cursor-pointer disabled:opacity-60"
          >
            Consume Spare Part
          </button>
        </form>
      </div>
    </div>
  );
}

export function ServiceCentreCreator({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pinCsv, setPinCsv] = useState("500,501");
  const [centreType, setCentreType] = useState<"OWNED_BENCH" | "AUTHORISED_PARTNER">(
    "AUTHORISED_PARTNER"
  );
  const [gstin, setGstin] = useState("");
  const [contactPhone, setContactPhone] = useState("+91-40-4010-2200");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const pinPrefixes = pinCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const supportedCategories: ProductCategory[] = [...PRODUCT_CATEGORIES];
      const res = await fetch("/api/app/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "centre",
          payload: {
            name,
            code,
            city,
            state: stateName,
            pinPrefixes,
            supportedCategories,
            centreType,
            gstin: gstin || undefined,
            contactPhone,
            maxActiveRepairs: 35,
          },
        }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Could not add service centre.");
        setBusy(false);
        return;
      }
      setName("");
      setCode("");
      setCity("");
      setStateName("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error creating centre.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cd-surface rounded-xl p-5 space-y-3">
      <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
        Add Regional Service Centre / Authorised Partner
      </h2>
      {error && (
        <AlertBanner tone="danger" title="Service Centre Error">
          {error}
        </AlertBanner>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="sc-name" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Centre Name
          </label>
          <input
            id="sc-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Deccan Tech Care"
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label htmlFor="sc-code" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Bench Code
          </label>
          <input
            id="sc-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="HYD-ASC-05"
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label htmlFor="sc-city" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            City
          </label>
          <input
            id="sc-city"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Hyderabad"
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label htmlFor="sc-state" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            State
          </label>
          <input
            id="sc-state"
            required
            value={stateName}
            onChange={(e) => setStateName(e.target.value)}
            placeholder="Telangana"
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label htmlFor="sc-pins" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            PIN Prefixes (CSV)
          </label>
          <input
            id="sc-pins"
            required
            value={pinCsv}
            onChange={(e) => setPinCsv(e.target.value)}
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label htmlFor="sc-type" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Type
          </label>
          <select
            id="sc-type"
            value={centreType}
            onChange={(e) =>
              setCentreType(e.target.value as "OWNED_BENCH" | "AUTHORISED_PARTNER")
            }
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 text-xs text-[var(--text-primary)]"
          >
            <option value="AUTHORISED_PARTNER">AUTHORISED_PARTNER</option>
            <option value="OWNED_BENCH">OWNED_BENCH</option>
          </select>
        </div>
        <div>
          <label htmlFor="sc-gstin" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Partner GSTIN
          </label>
          <input
            id="sc-gstin"
            value={gstin}
            onChange={(e) => setGstin(e.target.value)}
            placeholder="36AAACD1100M1Z5"
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label htmlFor="sc-phone" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Bench Phone
          </label>
          <input
            id="sc-phone"
            required
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] cursor-pointer"
      >
        Save Service Centre
      </button>
    </form>
  );
}
