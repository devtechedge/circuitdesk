"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AlertBanner, TechCode } from "./ui/primitives";

export function LoginForm({
  nextPath = "/app",
  demoEnabled = true,
}: {
  nextPath?: string;
  demoEnabled?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next: nextPath }),
      });
      const data = (await res.json()) as { redirectTo?: string; error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Sign-in failed.");
        setLoading(false);
        return;
      }
      router.push(data.redirectTo ?? "/app");
      router.refresh();
    } catch {
      setError("Network error while signing in.");
      setLoading(false);
    }
  }

  async function quickDemo(persona: "OWNER" | "SUPPORT" | "TECHNICIAN" | "ANALYST" | "READ_ONLY") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, next: nextPath }),
      });
      const data = (await res.json()) as { redirectTo?: string; error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Demo sign-in failed.");
        setLoading(false);
        return;
      }
      router.push(data.redirectTo ?? "/app");
      router.refresh();
    } catch {
      setError("Network error creating demo session.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleLogin}
        data-testid="login-form"
        className="cd-surface rounded-xl p-6 space-y-4"
      >
        {error && (
          <AlertBanner tone="danger" title="Sign-In Failed">
            {error}
          </AlertBanner>
        )}

        <div>
          <label htmlFor="login-email" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Work Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--signal-orange)] px-4 text-sm font-semibold text-[var(--on-signal)] cursor-pointer disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Sign in to workspace"}
        </button>

        <p className="m-0 text-center text-xs text-[var(--text-muted)]">
          New hardware brand?{" "}
          <Link href="/signup" className="text-[var(--signal-cobalt)] font-semibold hover:underline">
            Create a workspace
          </Link>
        </p>
      </form>

      {demoEnabled && (
        <div className="cd-elevated rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--signal-orange)]">
              Synthetic Demo Workspace (Kinetix Audio)
            </span>
            <TechCode>DEMO_MODE=true</TechCode>
          </div>
          <p className="m-0 text-xs text-[var(--text-secondary)]">
            One-click sign-in with real database sessions across RBAC roles (or enter{" "}
            <code className="font-mono">ops@kinetix-audio.demo</code> /{" "}
            <code className="font-mono">CircuitDesk-Demo-2026!</code>):
          </p>
          <div className="flex flex-wrap gap-2">
            {(["OWNER", "SUPPORT", "TECHNICIAN", "ANALYST", "READ_ONLY"] as const).map((r) => (
              <button
                key={r}
                type="button"
                disabled={loading}
                onClick={() => quickDemo(r)}
                data-testid={`quick-demo-${r.toLowerCase()}`}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-xs font-medium text-[var(--text-primary)] hover:border-[var(--signal-orange)] cursor-pointer disabled:opacity-60"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          companyName,
          brandName,
          currency,
        }),
      });
      const data = (await res.json()) as { redirectTo?: string; error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Workspace creation failed.");
        setLoading(false);
        return;
      }
      router.push(data.redirectTo ?? "/app/onboarding");
      router.refresh();
    } catch {
      setError("Network error while creating workspace.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSignup}
      data-testid="signup-form"
      className="cd-surface rounded-xl p-6 space-y-4"
    >
      {error && (
        <AlertBanner tone="danger" title="Could Not Create Workspace">
          {error}
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="su-name" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Full Name
          </label>
          <input
            id="su-name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="su-email" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Work Email
          </label>
          <input
            id="su-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="su-company" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Company Legal Name
          </label>
          <input
            id="su-company"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Aether Acoustics Pvt. Ltd."
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="su-brand" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Consumer Brand Name
          </label>
          <input
            id="su-brand"
            required
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="e.g. Aether Sound"
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="su-password" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Password (10+ characters)
          </label>
          <input
            id="su-password"
            type="password"
            minLength={10}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="su-currency" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Operating Currency
          </label>
          <select
            id="su-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "INR" | "USD")}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          >
            <option value="INR">INR (India · GST &amp; PIN Zones)</option>
            <option value="USD">USD (Global)</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--signal-orange)] px-4 text-sm font-semibold text-[var(--on-signal)] cursor-pointer disabled:opacity-60"
      >
        {loading ? "Provisioning workspace..." : "Create multi-tenant workspace"}
      </button>

      <p className="m-0 text-center text-xs text-[var(--text-muted)]">
        Already have an operator account?{" "}
        <Link href="/login" className="text-[var(--signal-cobalt)] font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
