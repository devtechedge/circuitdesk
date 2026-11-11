import type { Metadata } from "next";
import { PortalRegistrationForm } from "@/components/portal-forms";
import { SectionHeader } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Warranty Registration",
};

export default async function BrandRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string }>;
  searchParams: Promise<{ serial?: string; source?: string }>;
}) {
  const { brand } = await params;
  const query = await searchParams;
  const source =
    query.source?.toLowerCase() === "order" ? "ORDER_LOOKUP" : "QR";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Product Registration"
        title="Register your hardware serial"
        description="Verify your serial number against the official brand registry to receive a digital warranty certificate."
      />
      <PortalRegistrationForm
        brandSlug={brand}
        initialSerial={query.serial ?? ""}
        initialSource={source}
      />
    </div>
  );
}
