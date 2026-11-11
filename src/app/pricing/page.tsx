import type { Metadata } from "next";
import { PricingCalculator } from "@/components/pricing-calculator";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SectionHeader } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Pricing & Entitlements",
  description:
    "Transparent INR and USD plans for electronics and hardware warranty, returns, and repair operations.",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-7xl flex-1 px-4 py-12 sm:px-6 space-y-8">
        <SectionHeader
          eyebrow="Transparent Pricing"
          title="Plans built around hardware unit volume, not per-agent helpdesk tax"
          description="Start on a 14-day workspace trial. Switch between INR (Razorpay) and USD (Stripe) billing; when payment credentials are absent in demo deployments, billing runs in clearly labelled Non-Charging Demo Mode."
        />
        <PricingCalculator />
      </main>
      <SiteFooter />
    </>
  );
}
