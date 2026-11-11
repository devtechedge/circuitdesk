import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/azeret-mono";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { THEME_BOOT_SCRIPT } from "@/components/theme-toggle";
import { getEnv } from "@/env";

const appUrl = getEnv().APP_URL;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "CircuitDesk | Warranty, Returns & Repair Operations for Hardware Brands",
    template: "%s | CircuitDesk",
  },
  description:
    "Every product has an afterlife. Manage it beautifully. Serial and batch registries, QR warranty registration, human claim triage, PIN-routed repairs, spare parts, RMAs, and India GST exports.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "CircuitDesk | Warranty, Returns & Repair Operations",
    description:
      "Connected after-sales operations for electronics, audio, wearable, charging, and appliance brands selling 500 to 50,000 units/month.",
    url: appUrl,
    siteName: "CircuitDesk",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-[var(--signal-orange)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--on-signal)]"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
