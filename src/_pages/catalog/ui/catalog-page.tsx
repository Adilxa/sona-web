"use client";

import { useI18n } from "@/shared/i18n/context";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import * as Menu from "@animate-ui/react/primitives/radix-ui/dropdown-menu";
import { Bookmark, Check, ChevronDown, Film, History, ListFilter } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { findSeries, loadCollection, type CatalogSort, type CatalogTerm, type CatalogTile, type Collection } from "@/entities/series";
import { InteriorPage } from "@/shared/ui/interior-page";
import { useSession } from "@/entities/session";
import { usePage } from "@/shared/lib/use-page";
import { ActionLink } from "@/shared/ui/action-link";
import { SeriesCard } from "@/entities/series/ui/series-card";
import { useSeriesFavorites } from "@/entities/series/model/social";
import { pinnedFirst, useContinuePins } from "@/entities/series/model/continue-pins";
import { useSeriesCardDetails } from "@/entities/series/ui/series-card-details";
import { SonaLoader } from "@/shared/ui/sona-loader";
import type { Locale } from "@/shared/i18n/model";
import type { PublicSeriesBrief } from "@/shared/seo/catalog-reader";
import { localizedPath, seriesPath } from "@/shared/seo/urls";
import styles from "./catalog.module.css";

type Card = Awaited<ReturnType<typeof findSeries>>;
type BrowserFilters = { sort: CatalogSort; genre?: number };

export function EmbeddedCatalogFallback() {
  const { locale, t } = useI18n();
  return <section id="catalog" className={styles.embedded} aria-labelledby="catalog-title">
    <div className={styles.heading}>
      <h2 id="catalog-title" className="section-title">{t("Все сериалы", "All series")}</h2>
      <Link href={localizedPath("/catalog", locale)}>{t("Открыть каталог", "Browse the catalog")}</Link>
    </div>
    <div className={styles.loading}><SonaLoader label={t("Загружаем сериалы", "Loading series")} /></div>
  </section>;
}

function catalogHref(locale: Locale, sort: CatalogSort, genre?: number) {
  const params = new URLSearchParams();
  if (sort !== "new") params.set("sort", sort);
  if (genre !== undefined) params.set("genre", String(genre));
  return localizedPath(params.size ? "/catalog?" + params : "/catalog", locale);
}

function CatalogFilters({ sort, genre, terms, termName }: BrowserFilters & { terms: CatalogTerm[]; termName?: string }) {
  const { t, locale } = useI18n();
  const sorts: { value: CatalogSort; label: string }[] = [
    { value: "new", label: t("Новинки", "Newest") },
    { value: "popular", label: t("Популярные", "Popular") },
  ];

  const selected = terms.find(term => term.id === genre);
  return <div className={styles.controls}>
    <nav className={styles.sorts} aria-label={t("Сортировка каталога", "Sort catalog")}>
      {sorts.map(item => <ActionLink key={item.value} href={catalogHref(locale, item.value, genre)}
        scroll={false} aria-current={sort === item.value ? "true" : undefined}>{item.label}</ActionLink>)}
    </nav>
    {(terms.length > 0 || genre !== undefined) && <Menu.Root>
      <Menu.Trigger className={styles.select}><ListFilter size={16} aria-hidden="true" />
        {selected?.name ?? termName ?? (genre ? t("Выбранный жанр или тег", "Selected genre or tag") : t("Жанры и теги", "Genres and tags"))} <ChevronDown size={15} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal><Menu.Content className={styles.menu} align="start" sideOffset={6}>
        <Menu.Item asChild><Link scroll={false} href={catalogHref(locale, sort)}>{t("Все жанры и теги", "All genres and tags")} {!genre && <Check size={15} />}</Link></Menu.Item>
        {terms.map(term => <Menu.Item key={term.id} asChild>
          <Link scroll={false} href={catalogHref(locale, sort, term.id)}>{term.name} {genre === term.id && <Check size={15} />}</Link>
        </Menu.Item>)}
      </Menu.Content></Menu.Portal>
    </Menu.Root>}
  </div>;
}

function Empty({ collection, genre, sort }: BrowserFilters & { collection: Collection }) {
  const { t, locale } = useI18n();
  const saved = collection === "me/favorites", history = collection === "me/continue-watching";
  const Icon = saved ? Bookmark : history ? History : Film;
  const title = saved ? t("Избранное пока пусто", "No favorites yet") : history ? t("Вы ещё не начали просмотр", "You haven’t started watching yet")
    : genre !== undefined ? t("Сериалов с этим фильтром пока нет", "No series match this filter") : t("Сериалы пока не опубликованы", "No series have been published yet");
  const hint = saved ? t("Сохраняйте сериалы из их карточек, чтобы вернуться к ним позже.", "Save a series from its poster to watch it later.")
    : history ? t("Начатые серии появятся здесь вместе с сохранённой позицией.", "The shows you start will appear here, ready to resume where you left off.") : "";
  return <div className={styles.empty}>
    <Icon strokeWidth={1.5} size={25} aria-hidden="true" />
    <div><strong>{title}</strong>{hint && <p>{hint}</p>}</div>
    {genre !== undefined && <ActionLink className={styles.emptyLink} href={catalogHref(locale, sort)}>{t("Сбросить фильтр", "Clear filter")}</ActionLink>}
    {(saved || history) && <ActionLink className={styles.emptyLink} href={localizedPath("/catalog", locale)}>{t("В каталог", "Browse series")}</ActionLink>}
  </div>;
}

type GalleryProps = BrowserFilters & { collection: Collection; onDetails: (card: Card) => void; guest: boolean; viewerId: string; preview?: ReactNode };
type GalleryPage = { items: CatalogTile[]; busy: boolean; error: string; retry: () => void; next: string | boolean; more: () => void };

function Gallery(props: GalleryProps) {
  const { collection, sort, genre } = props;
  const load = useCallback((cursor: string, signal: AbortSignal) => loadCollection(collection, "", cursor, signal, { sort, genre, summariesOnly: true }), [collection, sort, genre]);
  const page = usePage(load);
  return <GalleryResults {...props} page={page} />;
}

function FavoritesGallery(props: GalleryProps) {
  const favorites = useSeriesFavorites(props.viewerId);
  const [limit, setLimit] = useState(24);
  const items = useMemo(() => (favorites.data ?? []).slice(0, limit).map(id => ({ id, title: "" })), [favorites.data, limit]);
  return <GalleryResults {...props} page={{
    items, busy: favorites.isPending, error: favorites.error?.message ?? "",
    retry: () => { void favorites.refetch(); }, next: (favorites.data?.length ?? 0) > limit, more: () => setLimit(n => n + 24),
  }} />;
}

function GalleryResults({ collection, sort, genre, onDetails, guest, viewerId, page, preview }: GalleryProps & { page: GalleryPage }) {
  const { t } = useI18n();
  const { container, cards } = useSeriesCardDetails<HTMLUListElement>(page.items, onDetails);
  const history = collection === "me/continue-watching";
  const pins = useContinuePins(history ? viewerId : undefined);
  const items = useMemo(() => pinnedFirst(page.items, pins, item => item.id), [page.items, pins]);
  return <>
    {items.length > 0 && <ul ref={container} className={history ? styles.historyGrid : styles.grid}>
      {items.map(item => <li key={item.id} data-series={item.id}>
        <SeriesCard item={item} card={cards[item.id]} guest={guest} viewerId={viewerId}
          variant={history ? "continue" : "poster"} pinned={history ? pins.has(item.id) : undefined} />
      </li>)}
    </ul>}
    {!items.length && (page.busy || page.error) && preview}
    {page.busy && (items.length > 0 || !preview) && <div className={styles.loading}><SonaLoader label={page.items.length ? t("Загружаем ещё сериалы", "Loading more series") : t("Загружаем сериалы", "Loading series")} /></div>}
    {page.error && <div className={styles.empty} role="alert"><div><strong>{t("Не удалось загрузить сериалы", "Couldn’t load the series")}</strong><p>{page.error}</p></div><Button className={styles.emptyLink} onClick={page.retry}>{t("Повторить", "Try again")}</Button></div>}
    {!page.busy && !page.error && !page.items.length && !page.next && <Empty collection={collection} sort={sort} genre={genre} />}
    {!page.busy && !page.error && page.next && <Button className={styles.more} onClick={page.more}>{t("Показать ещё", "Show more")}</Button>}
  </>;
}

export function CatalogPage({ initialCollection: collection, title: requestedTitle, embedded = false, sort = "new", genre, initialItems, initialLocale, termName }: {
  initialCollection: Collection;
  title?: string;
  embedded?: boolean;
  sort?: CatalogSort;
  genre?: number;
  initialItems?: PublicSeriesBrief[];
  initialLocale?: Locale;
  termName?: string;
}) {
  const { t, locale } = useI18n();
  const title = requestedTitle ?? (
    collection === "me/favorites" ? t("Избранное", "Favorites") :
    collection === "me/continue-watching" ? t("Продолжить просмотр", "Continue watching") :
    embedded ? t("Все сериалы", "All series") : t("Каталог сериалов", "Series catalog")
  );
  const { me, error: sessionError, reload } = useSession();
  const [available, setAvailable] = useState({ locale, terms: [] as CatalogTerm[] });
  const terms = available.locale === locale ? available.terms : [];
  const browse = collection === "catalog";
  const onDetails = useCallback((card: Card) => {
    if (!browse) return;
    setAvailable(previous => {
      const current = previous.locale === locale ? previous.terms : [];
      const terms = new Map(current.map(term => [term.id, term]));
      for (const term of [...card.genres, ...card.tags]) terms.set(term.id, term);
      if (terms.size === current.length && current.every(term => term.name === terms.get(term.id)?.name)) return previous;
      return { locale, terms: [...terms.values()].sort((a, b) => a.name.localeCompare(b.name, locale)) };
    });
  }, [browse, locale]);
  const ActiveGallery = collection === "me/favorites" ? FavoritesGallery : Gallery;
  const previewItems = browse && initialLocale === locale ? initialItems : undefined;
  const preview = previewItems?.length ? <ul className={styles.preview} aria-label={title}>
    {previewItems.map(item => <li key={item.id}>
      <Link href={localizedPath(seriesPath(item.id, item.slug), locale)} prefetch={false}>
        {item.title}<span aria-hidden="true">↗</span>
      </Link>
    </li>)}
  </ul> : previewItems ? <Empty collection={collection} sort={sort} genre={genre} /> : undefined;
  const content = <>
    {browse && <CatalogFilters sort={sort} genre={genre} terms={terms} termName={initialLocale === locale ? termName : undefined} />}
    {browse && initialLocale === locale && !initialItems && <noscript>
      <p>{t("Каталог временно недоступен.", "The catalog is temporarily unavailable.")}{" "}
        <a href={catalogHref(locale, sort, genre)}>{t("Попробуйте ещё раз", "Try again")}</a>
      </p>
    </noscript>}
    {sessionError ? <>{preview}<div className={styles.empty} role="alert"><strong>{sessionError}</strong><Button onClick={reload}>{t("Повторить", "Try again")}</Button></div></>
      : !me ? preview ?? <div className={styles.loading}><SonaLoader label={t("Загружаем сериалы", "Loading series")} /></div> : <ActiveGallery key={JSON.stringify([me.id, me.role, locale, collection, sort, genre])}
        collection={collection} sort={sort} genre={genre} onDetails={onDetails} guest={me.role === "guest"} viewerId={me.id} preview={preview} />}
  </>;
  if (embedded) return <section id="catalog" className={styles.embedded} aria-labelledby="catalog-title">
    <div className={styles.heading}><h2 id="catalog-title" className="section-title">{title}</h2></div>{content}
  </section>;
  return <InteriorPage id="catalog" title={title} back={browse ? { href: localizedPath("/", locale), label: t("Главная", "Home") } : { href: "/profile", label: t("Профиль", "Profile") }}>
    {content}
  </InteriorPage>;
}
