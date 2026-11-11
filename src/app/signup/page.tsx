import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/auth/session";
import { SignupForm } from "@/components/auth-forms";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create Hardware Brand Workspace",
  description: "Start a multi-tenant warranty, returns, and repair workspace on CircuitDesk.",
};

export default async function SignupPage() {
  const existing = await getCurrentSession();
  if (existing) {
    redirect("/app");
  }

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-xl flex-1 px-4 py-12 sm:px-6 w-full space-y-6">
        <div className="space-y-1 text-center">
          <p className="m-0 font-mono text-xs uppercase tracking-widest text-[var(--signal-orange)]">
            14-Day Trial &middot; No Credit Card Required
          </p>
          <h1 className="m-0 text-2xl font-bold text-[var(--text-primary)]">
            Create your brand workspace
          </h1>
          <p className="m-0 text-xs text-[var(--text-muted)]">
            Provisions an isolated tenant, initial brand portal (/w/[brand]), and 6-step activation checklist.
          </p>
        </div>

        <SignupForm />
      </main>
      <SiteFooter />
    </>
  );
}
