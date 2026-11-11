import Link from "next/link";
import { notFound } from "next/navigation";
import { TechCode } from "@/components/ui/primitives";
import { getBrandPortalContext } from "@/services/registrations";

export default async function BrandPortalLandingPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  const portal = await getBrandPortalContext(brand);
  if (!portal) notFound();

  return (
    <div className="space-y-6">
      <div className="cd-surface rounded-xl p-6 space-y-2">
        <TechCode>/w/{portal.brand.slug}</TechCode>
        <h1 className="m-0 text-2xl font-bold text-[var(--text-primary)]">
          {portal.brand.portalHeadline}
        </h1>
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          No password or customer account required. Every certificate and repair tracker uses a
          random, revocable security token.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href={`/w/${portal.brand.slug}/register`}
          className="cd-elevated rounded-xl p-6 space-y-2 hover:border-[var(--signal-orange)] no-underline"
        >
          <TechCode>STEP 01 · REGISTER</TechCode>
          <h2 className="m-0 text-lg font-bold text-[var(--text-primary)]">
            Activate Product Warranty
          </h2>
          <p className="m-0 text-sm text-[var(--text-secondary)]">
            Scan your packaging QR or enter your serial number to verify coverage and receive a
            printable digital warranty certificate.
          </p>
        </Link>

        <Link
          href={`/w/${portal.brand.slug}/claim`}
          className="cd-elevated rounded-xl p-6 space-y-2 hover:border-[var(--signal-cobalt)] no-underline"
        >
          <TechCode>STEP 02 · CLAIM OR REPAIR</TechCode>
          <h2 className="m-0 text-lg font-bold text-[var(--text-primary)]">
            Submit a Warranty or Dealer Claim
          </h2>
          <p className="m-0 text-sm text-[var(--text-secondary)]">
            Report a hardware fault, upload your receipt or defect photo (encrypted at rest), and
            receive a live repair tracking link.
          </p>
        </Link>
      </div>
    </div>
  );
}
