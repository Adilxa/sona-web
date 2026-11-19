import { cache } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { SeriesDetailsPage } from "@/_pages/series-details";
import { getServerLocale } from "@/shared/i18n/server";
import type { Locale } from "@/shared/i18n/model";
import { getPublicSeries } from "@/shared/seo/catalog.server";
import { publicMetadata } from "@/shared/seo/metadata";
import { siteOrigin } from "@/shared/config/site-origin";
import { seriesDescription, seriesJsonLd } from "@/shared/seo/series-metadata";
import { localizedPath, parseSeriesSegment, seriesPath } from "@/shared/seo/urls";

type Props = PageProps<"/series/[slug]">;
type Query = Awaited<Props["searchParams"]>;

function positive(value?: string | string[]) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 0;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : 0;
}

function withQuery(path: string, values: Query) {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === "string") query.append(name, value);
    else value?.forEach(part => query.append(name, part));
  }
  return query.size ? `${path}?${query}` : path;
}

// Share one snapshot between the document head and the viewer during this request.
const readSummary = cache(async (id: number, locale: Locale) => {
  try {
    return await getPublicSeries(id, locale);
  } catch {
    // The authenticated viewer can still recover if the public catalog is unavailable.
    return undefined;
  }
});

async function resolvePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const id = parseSeriesSegment(slug);
  if (id === null) notFound();
  const [locale, query] = await Promise.all([getServerLocale(), searchParams]);
  const series = await readSummary(id, locale);
  if (series === null) notFound();
  const path = seriesPath(id, series?.slug);
  if (series && path !== `/series/${slug}`) {
    permanentRedirect(withQuery(path, query));
  }
  return { id, locale, query, series, path };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, series, path } = await resolvePage(props);
  if (!series) return {
    title: locale === "ru" ? "Сериал" : "Series",
    robots: { index: false, follow: true }, alternates: null, openGraph: null, twitter: null,
  };
  return publicMetadata({
    path, locale, title: series.title, description: seriesDescription(series, locale),
    image: series.image, type: "video.tv_show",
  });
}

export default async function Page(props: Props) {
  const { id, locale, series, path, query: { episode, at, play } } = await resolvePage(props);
  return <>
    {series && <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html: seriesJsonLd(series, localizedPath(path, locale), siteOrigin()),
    }} />}
    <SeriesDetailsPage key={id} id={String(id)} summary={series}
      autoStart={play === "1"} episode={positive(episode)} at={positive(at)} />
  </>;
}
