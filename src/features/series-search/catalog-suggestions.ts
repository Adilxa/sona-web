import { useI18n } from "@/shared/i18n/context";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { loadCollection, type CatalogTile } from "@/entities/series";

const suggestionLimit = 12;
const words = (text: string) => text.normalize("NFKC").toLowerCase().replaceAll("ё", "е").match(/[\p{L}\p{N}]+/gu) ?? [];

export function matchCatalogTitles(query: string, pages: readonly { items: CatalogTile[] }[]) {
  // Match longer prefixes first so two input words cannot accidentally use the same title word.
  const terms = words(query).sort((a, b) => b.length - a.length);
  const matches = new Map<string, CatalogTile>();
  if (!terms.length) return [];
  for (const page of pages) {
    for (const item of page.items) {
      if (matches.has(item.id)) continue;
      const available = words(item.title);
      const matched = terms.every(term => {
        const index = available.findIndex(word => word.startsWith(term));
        if (index < 0) return false;
        available.splice(index, 1);
        return true;
      });
      if (matched) matches.set(item.id, item);
      if (matches.size >= suggestionLimit) return [...matches.values()];
    }
  }
  return [...matches.values()];
}

export function mergeSearchMatches(ranked: CatalogTile[], suggested: CatalogTile[]) {
  const merged = new Map<string, CatalogTile>();
  for (const item of [...ranked, ...suggested]) {
    const previous = merged.get(item.id);
    if (!previous) merged.set(item.id, item);
    else if (!previous.slug && item.slug) merged.set(item.id, { ...previous, slug: item.slug });
  }
  return [...merged.values()];
}

export function useCatalogSuggestions(query: string, viewer: string | undefined, locale: string | undefined,
  ready: boolean, ranked: CatalogTile[]) {
  const { t } = useI18n();
  const catalog = useInfiniteQuery({
    // Changing the text keeps the same brief pages. Closing the search drops its observer and cancels pending work.
    queryKey: ["series-search", "catalog", viewer ?? null, locale ?? null],
    enabled: Boolean(viewer && ready),
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) => loadCollection("catalog", "", pageParam, signal, { sort: "new", summariesOnly: true }),
    getNextPageParam: (page, _pages, _cursor, cursors) => page.next && !cursors.includes(page.next) ? page.next : undefined,
    staleTime: 60_000,
  });
  const suggestions = useMemo(() => matchCatalogTitles(query, catalog.data?.pages ?? []), [query, catalog.data]);
  const items = useMemo(() => mergeSearchMatches(ranked, suggestions), [ranked, suggestions]);
  const more = catalog.hasNextPage && items.length < suggestionLimit;
  const { fetchNextPage, isFetching, isError } = catalog;
  useEffect(() => {
    if (viewer && ready && more && !isFetching && !isError) void fetchNextPage({ cancelRefetch: false });
  }, [viewer, ready, more, isFetching, isError, fetchNextPage, catalog.data]);
  const last = catalog.data?.pages.at(-1);
  const repeatedCursor = last?.next && catalog.data?.pageParams.includes(last.next);
  return {
    items,
    pending: !isError && (catalog.isPending || isFetching || more),
    error: catalog.error?.message || (repeatedCursor ? t("Не удалось загрузить каталог полностью.", "Couldn’t load the full catalog.") : undefined),
    retry: () => catalog.isFetchNextPageError ? fetchNextPage() : catalog.refetch(),
  };
}
