import type { MetadataRoute } from "next";
import { getEnv } from "@/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getEnv().APP_URL.replace(/\/$/, "");
  const lastModified = new Date("2026-11-11T00:00:00.000Z");

  const publicPaths = [
    "",
    "/features",
    "/solutions/audio-wearables",
    "/solutions/smart-appliances",
    "/solutions/mobile-accessories",
    "/solutions/d2c-electronics",
    "/pricing",
    "/demo",
    "/guides",
    "/guides/india-electronics-warranty-gst-guide",
    "/guides/serial-batch-defect-tracking-d2c",
    "/guides/shopify-warranty-registration-vs-claims-ops",
    "/guides/pin-code-service-centre-routing-sla",
    "/integrations",
    "/security",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/dpa",
  ];

  return publicPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1.0 : 0.8,
  }));
}
