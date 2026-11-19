import "server-only";
import { cache } from "react";
import type { CatalogSort } from "@/entities/series";
import type { Locale } from "@/shared/i18n/model";
import { getServerLocale } from "@/shared/i18n/server";
import { getPublicCatalogPage, getPublicTermName } from "@/shared/seo/catalog.server";
import { CatalogPage } from "./catalog-page";

export const readPublicSelection = cache(async (locale: Locale, genre: number | undefined, sort: CatalogSort) => {
  const items = await getPublicCatalogPage(locale, genre, sort).catch(() => undefined);
  const first = items?.[0];
  const termName = genre && first ? await getPublicTermName(genre, locale, first.id).catch(() => undefined) : undefined;
  return { items, termName };
});

export async function PublicCatalog({ embedded, genre, sort = "new" }: {
  embedded?: boolean;
  genre?: number;
  sort?: CatalogSort;
}) {
  const locale = await getServerLocale();
  const { items, termName } = await readPublicSelection(locale, genre, sort);
  return <CatalogPage embedded={embedded} initialCollection="catalog" sort={sort} genre={genre}
    initialItems={embedded ? items?.slice(0, 8) : items} initialLocale={locale} termName={termName} />;
}
