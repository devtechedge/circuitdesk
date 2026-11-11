"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { FAULT_CATEGORIES, type FaultCategory, type SalesChannel } from "@/db/schema";
import { FAULT_TAXONOMY_META } from "@/domain/claim-signals";
import { AlertBanner, StatusBadge, TechCode } from "./ui/primitives";

export function PortalRegistrationForm({
  brandSlug,
  initialSerial = "",
  initialSource = "QR",
}: {
  brandSlug: string;
  initialSerial?: string;
  initialSource?: "QR" | "ORDER_LOOKUP" | "DEALER_RECEIPT";
}) {
  const [serialNumber, setSerialNumber] = useState(initialSerial);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPinCode, setCustomerPinCode] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [salesChannel, setSalesChannel] = useState<SalesChannel>("D2C_WEB");
  const [orderReference, setOrderReference] = useState("");
  const [dealerName, setDealerName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("2026-11-08");
  const [consentAccepted, setConsentAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    registrationNumber: string;
    status: string;
    coverageEndDate: string;
    certificatePath: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consentAccepted) {
      setError("Please accept the warranty data processing and retention notice.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(brandSlug)}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serialNumber,
          customerName,
          customerEmail,
          customerPhone,
          customerPinCode,
          customerCity,
          regionCode: "IN",
          salesChannel,
          sourceMethod:
            salesChannel === "OFFLINE_RETAIL" || salesChannel === "AUTHORISED_DEALER"
              ? "DEALER_RECEIPT"
              : initialSource,
          orderReference: orderReference || undefined,
          dealerName: dealerName || undefined,
          purchaseDate,
          consentAccepted: true,
        }),
      });
      const data = (await res.json()) as {
        registrationNumber?: string;
        status?: string;
        coverageEndDate?: string;
        certificatePath?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "Could not complete warranty registration.");
        setLoading(false);
        return;
      }
      setResult({
        registrationNumber: data.registrationNumber!,
        status: data.status!,
        coverageEndDate: data.coverageEndDate!,
        certificatePath: data.certificatePath!,
      });
      setLoading(false);
    } catch {
      setError("Network error submitting registration.");
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div data-testid="registration-success" className="cd-surface rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TechCode>{result.registrationNumber}</TechCode>
          <StatusBadge tone={result.status === "ACTIVE" ? "ok" : "warn"}>
            {result.status}
          </StatusBadge>
        </div>

        <h2 className="m-0 text-xl font-bold text-[var(--text-primary)]">
          {result.status === "ACTIVE"
            ? "Warranty Activated"
            : "Queued for Offline Receipt Verification"}
        </h2>

        <p className="m-0 text-sm text-[var(--text-secondary)]">
          {result.status === "ACTIVE"
            ? `Coverage active through ${result.coverageEndDate.slice(0, 10)}. Save your private certificate link below:`
            : "Offline retail and dealer purchases undergo human invoice verification before active coverage issues. Bookmark your status certificate link below:"}
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href={result.certificatePath}
            data-testid="open-certificate-link"
            className="inline-flex h-10 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] no-underline"
          >
            Open Warranty Certificate &rarr;
          </Link>
          <Link
            href={`/w/${brandSlug}/claim?serial=${encodeURIComponent(serialNumber)}`}
            className="inline-flex h-10 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 text-xs font-semibold text-[var(--text-primary)] no-underline"
          >
            File a Claim on This Unit
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="portal-register-form"
      className="cd-surface rounded-xl p-5 sm:p-6 space-y-4"
    >
      {error && (
        <AlertBanner tone="danger" title="Registration Error">
          {error}
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="reg-serial" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Device Serial Number
          </label>
          <input
            id="reg-serial"
            required
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="e.g. KNX-P2-2609-0018"
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="reg-channel" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Purchase Channel
          </label>
          <select
            id="reg-channel"
            value={salesChannel}
            onChange={(e) => setSalesChannel(e.target.value as SalesChannel)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          >
            <option value="D2C_WEB">Brand Official Website (D2C)</option>
            <option value="MARKETPLACE">Online Marketplace (Amazon / Flipkart)</option>
            <option value="AUTHORISED_DEALER">Authorised Dealer (Review Required)</option>
            <option value="OFFLINE_RETAIL">Offline Retail Store (Review Required)</option>
          </select>
        </div>

        <div>
          <label htmlFor="reg-date" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Purchase Date
          </label>
          <input
            id="reg-date"
            type="date"
            required
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="reg-order" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Order / Invoice Reference
          </label>
          <input
            id="reg-order"
            value={orderReference}
            onChange={(e) => setOrderReference(e.target.value)}
            placeholder="e.g. SHP-IN-11044"
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)]"
          />
        </div>

        {(salesChannel === "OFFLINE_RETAIL" || salesChannel === "AUTHORISED_DEALER") && (
          <div className="sm:col-span-2">
            <label htmlFor="reg-dealer" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              Retail Store / Dealer Name
            </label>
            <input
              id="reg-dealer"
              required
              value={dealerName}
              onChange={(e) => setDealerName(e.target.value)}
              placeholder="Store name and branch"
              className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
            />
          </div>
        )}

        <div>
          <label htmlFor="reg-name" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Owner Full Name
          </label>
          <input
            id="reg-name"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="reg-email" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Email Address
          </label>
          <input
            id="reg-email"
            type="email"
            required
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="reg-phone" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Phone / WhatsApp
          </label>
          <input
            id="reg-phone"
            required
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+91-98200-00000"
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="reg-pin" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              PIN / Postal Code
            </label>
            <input
              id="reg-pin"
              required
              value={customerPinCode}
              onChange={(e) => setCustomerPinCode(e.target.value)}
              placeholder="400053"
              className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label htmlFor="reg-city" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              City
            </label>
            <input
              id="reg-city"
              required
              value={customerCity}
              onChange={(e) => setCustomerCity(e.target.value)}
              placeholder="Mumbai"
              className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5">
        <label className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            data-testid="reg-consent-checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--signal-orange)]"
          />
          <span>
            I consent to processing my contact and serial details solely for warranty registration,
            repair logistics, and statutory recall notices (retained for up to 3 years per{" "}
            <Link href="/privacy" className="underline">
              DPDP Privacy Notice
            </Link>
            ).
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--signal-orange)] px-4 text-sm font-semibold text-[var(--on-signal)] cursor-pointer disabled:opacity-60"
      >
        {loading ? "Validating serial & policy..." : "Activate Warranty Coverage"}
      </button>
    </form>
  );
}

export function PortalClaimForm({
  brandSlug,
  initialSerial = "",
}: {
  brandSlug: string;
  initialSerial?: string;
}) {
  const [serialNumber, setSerialNumber] = useState(initialSerial);
  const [submittedByType, setSubmittedByType] = useState<"CUSTOMER" | "DEALER">("CUSTOMER");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingPinCode, setShippingPinCode] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [faultCategory, setFaultCategory] = useState<FaultCategory>("BATTERY");
  const [symptomSummary, setSymptomSummary] = useState("");
  const [customerDescription, setCustomerDescription] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("2026-11-01");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    claimNumber: string;
    status: string;
    trackingPath: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const form = new FormData();
      form.set("serialNumber", serialNumber);
      form.set("submittedByType", submittedByType);
      form.set("customerName", customerName);
      form.set("customerEmail", customerEmail);
      form.set("customerPhone", customerPhone);
      form.set("shippingPinCode", shippingPinCode);
      form.set("shippingCity", shippingCity);
      form.set("shippingAddress", shippingAddress);
      form.set("faultCategory", faultCategory);
      form.set("symptomSummary", symptomSummary);
      form.set("customerDescription", customerDescription);
      form.set("purchaseDate", purchaseDate);
      if (evidenceFile) {
        form.set("evidence", evidenceFile);
        form.set("evidenceKind", "RECEIPT");
      }

      const res = await fetch(`/api/portal/${encodeURIComponent(brandSlug)}/claim`, {
        method: "POST",
        body: form,
      });

      const data = (await res.json()) as {
        claimNumber?: string;
        status?: string;
        trackingPath?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "Claim submission failed.");
        setLoading(false);
        return;
      }

      setSubmitted({
        claimNumber: data.claimNumber!,
        status: data.status!,
        trackingPath: data.trackingPath!,
      });
      setLoading(false);
    } catch {
      setError("Network error submitting warranty claim.");
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div data-testid="claim-success" className="cd-surface rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TechCode>{submitted.claimNumber}</TechCode>
          <StatusBadge tone="info">{submitted.status}</StatusBadge>
        </div>
        <h2 className="m-0 text-xl font-bold text-[var(--text-primary)]">
          Claim Queued for Human Triage
        </h2>
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          Our warranty specialists review every claim personally; automated checks never auto-reject
          coverage. Save your private tracking link below:
        </p>
        <Link
          href={submitted.trackingPath}
          data-testid="open-tracker-link"
          className="inline-flex h-10 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] no-underline"
        >
          Open Live Claim &amp; Repair Tracker &rarr;
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="portal-claim-form"
      className="cd-surface rounded-xl p-5 sm:p-6 space-y-4"
    >
      {error && (
        <AlertBanner tone="danger" title="Claim Intake Error">
          {error}
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="clm-serial" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Device Serial Number
          </label>
          <input
            id="clm-serial"
            required
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="e.g. KNX-P2-2609-0018"
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="clm-by" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Submitted By
          </label>
          <select
            id="clm-by"
            value={submittedByType}
            onChange={(e) => setSubmittedByType(e.target.value as "CUSTOMER" | "DEALER")}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          >
            <option value="CUSTOMER">Product Owner (Customer)</option>
            <option value="DEALER">Authorised Dealer / Stockist</option>
          </select>
        </div>

        <div>
          <label htmlFor="clm-fault" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Fault Category
          </label>
          <select
            id="clm-fault"
            value={faultCategory}
            onChange={(e) => setFaultCategory(e.target.value as FaultCategory)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          >
            {FAULT_CATEGORIES.map((f) => (
              <option key={f} value={f}>
                {f} - {FAULT_TAXONOMY_META[f].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="clm-pdate" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Purchase Date
          </label>
          <input
            id="clm-pdate"
            type="date"
            required
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="clm-summary" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Short Symptom Headline
          </label>
          <input
            id="clm-summary"
            required
            minLength={6}
            value={symptomSummary}
            onChange={(e) => setSymptomSummary(e.target.value)}
            placeholder="e.g. Right earbud shuts down after 15 minutes of playback"
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="clm-desc" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Detailed Issue &amp; Troubleshooting Tried
          </label>
          <textarea
            id="clm-desc"
            required
            minLength={10}
            rows={3}
            value={customerDescription}
            onChange={(e) => setCustomerDescription(e.target.value)}
            placeholder="Include order reference, when the fault started, and charger/firmware details..."
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="clm-name" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Contact Name
          </label>
          <input
            id="clm-name"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="clm-email" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Contact Email
          </label>
          <input
            id="clm-email"
            type="email"
            required
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="clm-phone" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Contact Phone
          </label>
          <input
            id="clm-phone"
            required
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+91-98200-00000"
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 min-w-0">
          <div>
            <label htmlFor="clm-pin" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              6-Digit PIN Code
            </label>
            <input
              id="clm-pin"
              required
              value={shippingPinCode}
              onChange={(e) => setShippingPinCode(e.target.value)}
              placeholder="400053"
              className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label htmlFor="clm-city" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
              City
            </label>
            <input
              id="clm-city"
              required
              value={shippingCity}
              onChange={(e) => setShippingCity(e.target.value)}
              placeholder="Mumbai"
              className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="clm-addr" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Pickup / Return Shipping Street Address
          </label>
          <input
            id="clm-addr"
            required
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div className="sm:col-span-2 min-w-0">
          <label htmlFor="clm-file" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Receipt or Fault Photo (Optional · PNG, JPEG, WebP or PDF up to 4 MB · Encrypted at Rest)
          </label>
          <input
            id="clm-file"
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-xs text-[var(--text-secondary)]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--signal-orange)] px-4 text-sm font-semibold text-[var(--on-signal)] cursor-pointer disabled:opacity-60"
      >
        {loading ? "Encrypting evidence & creating claim..." : "Submit Warranty Claim"}
      </button>
    </form>
  );
}
