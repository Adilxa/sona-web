import type { Locale } from "@/shared/i18n/model";
import type { PublicSeries } from "./catalog.server";

export function seriesDescription(series: PublicSeries, locale: Locale) {
  const description = series.description.trim().replace(/\s+/g, " ");
  if (description) {
    const characters = Array.from(description);
    if (characters.length <= 180) return description;
    const beginning = characters.slice(0, 179).join("");
    const lastSpace = beginning.lastIndexOf(" ");
    return (lastSpace >= 120 ? beginning.slice(0, lastSpace) : beginning).trimEnd() + "…";
  }
  const count = series.episodesCount;
  const number = locale === "en"
    ? `${count} ${count === 1 ? "episode" : "episodes"}`
    : `Серий: ${count}`;
  return [series.title, ...series.genres, number].join(" · ");
}

export function seriesJsonLd(series: PublicSeries, path: string, origin?: string) {
  const url = origin ? new URL(path, origin).href : undefined;
  // The API's lang describes the synopsis translation, not the audio language.
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TVSeries",
    "@id": url && `${url}#series`,
    url,
    name: series.title,
    description: series.description.trim() || undefined,
    genre: series.genres.length ? series.genres : undefined,
    numberOfEpisodes: series.episodesCount,
    image: series.image,
  }).replace(/</g, "\\u003c");
}
