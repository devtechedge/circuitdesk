import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Security & Multi-Tenant Isolation",
  description:
    "PostgreSQL Row-Level Security, 7-role RBAC, scrypt sessions, AES-256-GCM secrets, private signed evidence URLs, and replay-safe webhooks.",
};

export default function SecurityPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-7xl flex-1 px-4 py-12 sm:px-6 space-y-10">
        <SectionHeader
          eyebrow="Trust & Defense in Depth"
          title="Multi-tenant security engineered from the schema up"
          description="CircuitDesk never trusts client-supplied tenant IDs, enforces server-side RBAC on every route, and isolates tenant rows in PostgreSQL."
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              tag: "TENANT ISOLATION + RLS",
              title: "Dual Application + PostgreSQL RLS Enforcement",
              body: "Every tenant table carries a non-null tenant_id foreign key, queried inside transactions that pin app.current_tenant_id under FORCE ROW LEVEL SECURITY.",
            },
            {
              tag: "AUTHENTICATION",
              title: "Scrypt Hashing & Revocable HttpOnly Sessions",
              body: "Passwords use Node crypto scrypt with per-user random salts and constant-time comparison. Session cookies are HttpOnly, SameSite=Lax, Secure in production, and revocable.",
            },
            {
              tag: "PRIVATE EVIDENCE",
              title: "AES-256-GCM Encrypted Blobs & Signed URLs",
              body: "Customer invoices and fault photos validate magic-byte headers (<= 4 MB), encrypt at rest in PostgreSQL, and serve only via short-lived HMAC-signed URLs with nosniff + sandbox CSP.",
            },
            {
              tag: "PORTAL TOKENS & KEYS",
              title: "Zero-Account Scoped SHA-256 Tokens",
              body: "Customer certificate (cd_cert_*) and claim tracking (cd_trk_*) links, plus REST API keys (cd_live_*), store only SHA-256 digests and support instant revocation.",
            },
            {
              tag: "WEBHOOK INTEGRITY",
              title: "Replay-Safe HMACs & Idempotency Ledger",
              body: "Timestamped webhook signatures enforce a 300-second replay window and deduplicate against webhook_events (provider, external_event_id).",
            },
            {
              tag: "PRIVACY & SERIAL MASKING",
              title: "Role-Based Serial Masking & DPDP Erasure",
              body: "Public portals, Analysts, and Read-Only auditors receive masked serials/IMEIs. Owners and Admins can export or redact Data Principal PII while preserving statutory audit sums.",
            },
          ].map((card) => (
            <div key={card.tag} className="cd-surface rounded-lg p-5 space-y-2.5">
              <TechCode>{card.tag}</TechCode>
              <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">{card.title}</h2>
              <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">
                {card.body}
              </p>
            </div>
          ))}
        </div>

        <section className="space-y-3">
          <h2 className="m-0 text-xl font-bold text-[var(--text-primary)]">
            7-Role RBAC Authorization Matrix
          </h2>
          <DataTableWrap label="7-role RBAC permission matrix">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                  <th className="p-3">Role</th>
                  <th className="p-3">Unmasked Serials</th>
                  <th className="p-3">Claim Triage</th>
                  <th className="p-3">Bench Repairs</th>
                  <th className="p-3">GST &amp; Analytics</th>
                  <th className="p-3">Billing / Recall / DPDP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {[
                  ["OWNER", "Yes", "Yes", "All Centres", "Yes", "Full Access"],
                  ["ADMIN", "Yes", "Yes", "All Centres", "Yes", "Full Access"],
                  ["OPERATIONS", "Yes", "Yes", "All Centres", "Yes", "No"],
                  ["SUPPORT", "Yes", "Yes", "Read Only", "No", "No"],
                  ["TECHNICIAN", "Yes", "No", "Assigned Bench Only", "No", "No"],
                  ["ANALYST", "Masked", "No", "Read Only", "Yes", "No"],
                  ["READ_ONLY", "Masked", "No", "Read Only", "No", "Audit Read Only"],
                ].map(([role, serial, triage, bench, gst, admin]) => (
                  <tr key={role}>
                    <td className="p-3">
                      <TechCode>{role}</TechCode>
                    </td>
                    <td className="p-3 text-[var(--text-secondary)]">{serial}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{triage}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{bench}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{gst}</td>
                    <td className="p-3">
                      <StatusBadge tone={admin === "Full Access" ? "ok" : "neutral"}>
                        {admin}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableWrap>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
