import type { Metadata } from "next";
import { PortalClaimForm } from "@/components/portal-forms";
import { SectionHeader } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Submit Warranty Claim",
};

export default async function BrandClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string }>;
  searchParams: Promise<{ serial?: string }>;
}) {
  const { brand } = await params;
  const query = await searchParams;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Warranty & Repair Claim"
        title="Report a hardware issue"
        description="Provide your serial number, select the fault category, and attach an optional receipt or defect photo. Human specialists adjudicate every request."
      />
      <PortalClaimForm brandSlug={brand} initialSerial={query.serial ?? ""} />
    </div>
  );
}
