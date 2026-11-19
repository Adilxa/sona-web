import type { MetadataRoute } from "next";
import { getPublicCatalog } from "@/shared/seo/catalog.server";
import { siteOrigin } from "@/shared/config/site-origin";
import { localizedPath, seriesPath } from "@/shared/seo/urls";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  if (!origin) throw new Error("Set SONA_SITE_ORIGIN to generate the sitemap.");
  // Slugs and publication status are shared across translations.
  const catalogue = await getPublicCatalog("ru");
  const paths = new Set(["/", "/catalog", "/feed", "/privacy", "/terms", "/help", ...catalogue.map(item => seriesPath(item.id, item.slug))]);
  return [...paths].flatMap(path => {
    const languages = {
      ru: origin + localizedPath(path, "ru"), en: origin + localizedPath(path, "en"), "x-default": origin + path,
    };
    return [languages.ru, languages.en].map(url => ({ url, alternates: { languages } }));
  });
}
