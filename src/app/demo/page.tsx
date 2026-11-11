import type { Metadata } from "next";
import { InteractiveSandbox } from "@/components/interactive-sandbox";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SectionHeader } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Synthetic Interactive Demo",
  description:
    "Explore CircuitDesk's multi-role operator console, zero-account customer portal, and PIN-code service routing engine on synthetic data.",
};

export default function DemoPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-7xl flex-1 px-4 py-12 sm:px-6 space-y-8">
        <SectionHeader
          eyebrow="Interactive Sandbox"
          title="Test every after-sales surface in sixty seconds"
          description="Launch a real database session into the Kinetix Audio synthetic workspace, register a serialized unit via QR, or inspect PIN-based repair routing."
        />
        <InteractiveSandbox />
      </main>
      <SiteFooter />
    </>
  );
}
