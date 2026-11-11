import type { MetadataRoute } from "next";
import { getEnv } from "@/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getEnv().APP_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/features",
          "/solutions/",
          "/pricing",
          "/demo",
          "/guides",
          "/integrations",
          "/security",
          "/about",
          "/contact",
          "/privacy",
          "/terms",
          "/dpa",
        ],
        disallow: ["/app", "/app/", "/api/", "/w/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
