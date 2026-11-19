import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLocale } from "@/shared/i18n/model";
import { getServerLocale } from "@/shared/i18n/server";
import { publicMetadata } from "@/shared/seo/metadata";
import { PublicCatalog, readPublicSelection } from "@/_pages/catalog/ui/public-catalog";

function filters(params: Awaited<PageProps<"/catalog">["searchParams"]>) {
  const value = typeof params.genre === "string" && /^\d+$/.test(params.genre) ? Number(params.genre) : 0;
  const genre = value > 0 && value <= 2147483647 ? value : undefined;
  const sort = params.sort === "popular" ? "popular" : "new";
  return { genre, sort } as const;
}

export async function generateMetadata({ searchParams }: PageProps<"/catalog">): Promise<Metadata> {
  const [params, locale] = await Promise.all([searchParams, getServerLocale()]);
  const { genre, sort } = filters(params);
  const term = genre ? (await readPublicSelection(locale, genre, sort)).termName : undefined;
  const english = locale === "en";
  const base = publicMetadata({
    locale,
    path: term ? "/catalog?genre=" + genre : "/catalog",
    title: term ? (english ? `${term} series` : `Сериалы по теме «${term}»`) : (english ? "Vertical AI series catalog" : "Каталог вертикальных AI-сериалов"),
    description: term
      ? (english ? `Explore the ${term} collection on SONA. Pick a vertical AI series and watch its short episodes online.` : `Подборка «${term}» на SONA. Выберите вертикальный AI-сериал и смотрите короткие серии онлайн.`)
      : (english ? "Browse short vertical AI series on SONA. Explore new releases and popular shows, find a genre you like, and start watching online." : "Короткие вертикальные AI-сериалы на SONA. Посмотрите новинки и популярные сериалы, выберите жанр и начните смотреть онлайн."),
  });
  return params.search !== undefined || params.q !== undefined ? { ...base, robots: { index: false, follow: true } } : base;
}

export default async function Page({ searchParams }: PageProps<"/catalog">) {
  const params = await searchParams;
  const { genre, sort } = filters(params);
  if ((params.genre !== undefined && !genre) || (params.sort !== undefined && params.sort !== sort)) {
    const valid = new URLSearchParams();
    if (sort !== "new") valid.set("sort", sort);
    if (genre) valid.set("genre", String(genre));
    if (isLocale(params.lang)) valid.set("lang", params.lang);
    if (typeof params.search === "string") valid.set("search", params.search.trim().slice(0,100));
    else if (typeof params.q === "string") valid.set("search", params.q.trim().slice(0,100));
    redirect(valid.size ? "/catalog?" + valid : "/catalog");
  }
  return <PublicCatalog sort={sort} genre={genre} />;
}
