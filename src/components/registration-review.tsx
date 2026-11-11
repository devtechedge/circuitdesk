"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegistrationReviewActions({
  registrationId,
  status,
  canReview,
}: {
  registrationId: string;
  status: string;
  canReview: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!canReview || status === "ERASED" || status === "REVOKED") {
    return <span className="font-mono text-xs text-[var(--text-muted)]">-</span>;
  }

  async function act(action: "APPROVE" | "REJECT" | "REVOKE_TOKEN") {
    setBusy(true);
    try {
      await fetch("/api/app/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, action }),
      });
      setBusy(false);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "PENDING_REVIEW" && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => act("APPROVE")}
            className="rounded bg-[var(--status-ok-bg)] border border-[var(--status-ok-border)] px-2 py-1 font-mono text-[11px] text-[var(--status-ok-fg)] cursor-pointer"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act("REJECT")}
            className="rounded bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] px-2 py-1 font-mono text-[11px] text-[var(--status-danger-fg)] cursor-pointer"
          >
            Reject
          </button>
        </>
      )}
      {status === "ACTIVE" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act("REVOKE_TOKEN")}
          className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 font-mono text-[11px] text-[var(--text-secondary)] hover:border-[var(--status-danger-border)] cursor-pointer"
        >
          Revoke Token
        </button>
      )}
    </div>
  );
}
