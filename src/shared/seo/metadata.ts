import type { Metadata } from "next";
import type { Locale } from "../i18n/model";
import { localizedPath } from "./urls";
import { siteOrigin } from "../config/site-origin";

export function publicMetadata({ path, title, description, locale, image, type = "website" }: {
  path: string; title: string; description: string; locale: Locale; image?: string; type?: "website" | "video.tv_show";
}): Metadata {
  const origin = siteOrigin();
  const canonical = origin && origin + localizedPath(path, locale);
  const branded = title + " · SONA";
  return {
    title: { absolute: branded }, description,
    ...(origin && { alternates: { canonical, languages: {
      ru: origin + localizedPath(path, "ru"), en: origin + localizedPath(path, "en"), "x-default": origin + path,
    } } }),
    openGraph: { type, title: branded, description, siteName: "SONA", locale: locale === "en" ? "en_US" : "ru_RU",
      ...(canonical && { url: canonical }), ...(image && { images: [{ url: image }] }) },
    twitter: { card: image ? "summary_large_image" : "summary", title: branded, description, ...(image && { images: [image] }) },
  };
}
