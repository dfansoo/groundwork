import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Not secret — just pages with no crawl value. A signed-out crawler sees
      // only redirects here.
      disallow: ["/account", "/account/", "/api/", "/login", "/register", "/forgot-password", "/reset-password"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
