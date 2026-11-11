import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/auth/session";
import { LoginForm } from "@/components/auth-forms";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isDemoMode } from "@/env";
import { sanitizeNextPath } from "@/security/csrf";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operator Sign In",
  description: "Sign in to your CircuitDesk warranty, returns, and repair workspace.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const existing = await getCurrentSession();
  const params = await searchParams;
  const safeNext = sanitizeNextPath(params.next, "/app");

  if (existing) {
    redirect(safeNext);
  }

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-md flex-1 px-4 py-12 sm:px-6 w-full space-y-6">
        <div className="space-y-1 text-center">
          <p className="m-0 font-mono text-xs uppercase tracking-widest text-[var(--signal-orange)]">
            Operator Console
          </p>
          <h1 className="m-0 text-2xl font-bold text-[var(--text-primary)]">
            Sign in to CircuitDesk
          </h1>
          <p className="m-0 text-xs text-[var(--text-muted)]">
            Customers registering a product do not need an account; use your brand&apos;s /w/[brand] link.
          </p>
        </div>

        <LoginForm nextPath={safeNext} demoEnabled={isDemoMode()} />
      </main>
      <SiteFooter />
    </>
  );
}
