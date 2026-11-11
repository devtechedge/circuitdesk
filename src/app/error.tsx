"use client";

export default function GlobalRouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center"
    >
      <p className="m-0 font-mono text-xs uppercase tracking-widest text-[var(--signal-orange)]">
        Operations Console Fault
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
        Something interrupted this view
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Your workspace data remains intact. Retry the action or return to the dashboard.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-5 inline-flex h-10 items-center rounded-md bg-[var(--signal-orange)] px-4 text-sm font-semibold text-[var(--on-signal)] cursor-pointer"
      >
        Retry view
      </button>
    </main>
  );
}
