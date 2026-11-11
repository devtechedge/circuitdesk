import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SectionHeader } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Contact, Enterprise Quotes & Migration Help",
  description:
    "Request a workflow walkthrough, custom Enterprise volume quote, or legacy warranty CSV migration assistance.",
};

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 space-y-8">
        <SectionHeader
          eyebrow="Contact & Onboarding"
          title="Plan your hardware warranty & repair rollout"
          description="Share your monthly unit volume, sales channels, and service-centre structure. Inquiries store directly in PostgreSQL with rate limiting and CSRF validation."
        />
        <ContactForm />
      </main>
      <SiteFooter />
    </>
  );
}
