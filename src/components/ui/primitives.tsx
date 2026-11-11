import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "ok" | "warn" | "danger" | "info" | "neutral";

const TONE_STYLES: Record<BadgeTone, string> = {
  ok: "bg-[var(--status-ok-bg)] text-[var(--status-ok-fg)] border-[var(--status-ok-border)]",
  warn: "bg-[var(--status-warn-bg)] text-[var(--status-warn-fg)] border-[var(--status-warn-border)]",
  danger:
    "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border-[var(--status-danger-border)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-fg)] border-[var(--status-info-border)]",
  neutral: "bg-[var(--bg-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-mono font-medium tracking-wide uppercase",
        TONE_STYLES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function TechCode({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <code
      className={cn(
        "inline-block rounded border border-[var(--border-subtle)] bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-primary)]",
        className
      )}
    >
      {children}
    </code>
  );
}

export function MetricTile({
  label,
  value,
  unitNote,
  badge,
}: {
  label: string;
  value: string;
  unitNote: string;
  badge?: ReactNode;
}) {
  return (
    <div className="cd-surface rounded-lg p-4 flex flex-col justify-between gap-2 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
        {badge}
      </div>
      <div className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
        {value}
      </div>
      <p className="m-0 text-xs text-[var(--text-muted)]">{unitNote}</p>
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--border-subtle)] pb-4">
      <div className="space-y-1 min-w-0">
        {eyebrow && (
          <p className="m-0 font-mono text-xs uppercase tracking-widest text-[var(--signal-orange)]">
            {eyebrow}
          </p>
        )}
        <h1 className="m-0 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {title}
        </h1>
        {description && (
          <p className="m-0 text-sm text-[var(--text-secondary)] max-w-3xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function AlertBanner({
  tone = "info",
  title,
  children,
}: {
  tone?: BadgeTone;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      aria-live="polite"
      className={cn("rounded-lg border p-3.5 text-sm", TONE_STYLES[tone])}
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-1 opacity-95">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="cd-surface rounded-lg p-8 text-center space-y-2">
      <h3 className="m-0 text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="m-0 text-sm text-[var(--text-muted)] max-w-md mx-auto">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function DataTableWrap({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="table-wrap cd-surface rounded-lg"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
