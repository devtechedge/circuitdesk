import Link from "next/link";
import { cn } from "@/lib/cn";

export function BrandMark({
  href = "/",
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={compact ? "CircuitDesk Operations Home" : undefined}
      className={cn(
        "inline-flex items-center gap-2.5 font-semibold tracking-tight text-[var(--text-primary)] no-underline",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)]"
      >
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none">
          <path
            d="M7 10H19L24 15V23H11L7 19V10Z"
            stroke="var(--signal-cobalt)"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M12 16.5H19.5"
            stroke="var(--signal-orange)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="10.5" cy="16.5" r="1.8" fill="var(--signal-orange)" />
          <circle cx="21" cy="16.5" r="1.8" fill="var(--signal-cobalt)" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-wider uppercase">CircuitDesk</span>
          <span className="text-[10px] font-mono text-[var(--text-muted)] tracking-widest uppercase">
            After-Sales Ops
          </span>
        </span>
      )}
    </Link>
  );
}
