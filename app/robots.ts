import type { MetadataRoute } from "next";
import { siteOrigin } from "@/shared/config/site-origin";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    ...(origin && { sitemap: origin + "/sitemap.xml" }),
  };
}
