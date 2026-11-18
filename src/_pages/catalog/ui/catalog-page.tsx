"use client";

import { Button } from "@animate-ui/react/primitives/buttons/button";
import * as Menu from "@animate-ui/react/primitives/radix-ui/dropdown-menu";
import { Bookmark, Check, ChevronDown, Film, History, ListFilter } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { findSeries, loadCollection, type CatalogSort, type CatalogTerm, type CatalogTile, type Collection } from "@/entities/series";
import { InteriorPage } from "@/shared/ui/interior-page";
import { useSession } from "@/entities/session";
import { usePage } from "@/shared/lib/use-page";
import { ActionLink } from "@/shared/ui/action-link";
import { SeriesCard } from "@/entities/series/ui/series-card";
import { useSeriesFavorites } from "@/entities/series/model/social";
import { useSeriesCardDetails } from "@/entities/series/ui/series-card-details";
import { SonaLoader } from "@/shared/ui/sona-loader";
import styles from "./catalog.module.css";

type Card = Awaited<ReturnType<typeof findSeries>>;
type BrowserFilters = { sort: CatalogSort; genre?: number };
const sorts: { value: CatalogSort; label: string }[] = [
  { value: "new", label: "Новинки" },
  { value: "popular", label: "Популярные" },
];

function catalogHref(sort: CatalogSort, genre?: number) {
  const params = new URLSearchParams();
  if (sort !== "new") params.set("sort", sort);
  if (genre !== undefined) params.set("genre", String(genre));
  return params.size ? "/catalog?" + params : "/catalog";
}

function CatalogFilters({ sort, genre, terms }: BrowserFilters & { terms: CatalogTerm[] }) {
  const selected = terms.find(term => term.id === genre);
  return <div className={styles.controls}>
    <nav className={styles.sorts} aria-label="Сортировка каталога">
      {sorts.map(item => <ActionLink key={item.value} href={catalogHref(item.value, genre)}
        scroll={false} aria-current={sort === item.value ? "true" : undefined}>{item.label}</ActionLink>)}
    </nav>
    {(terms.length > 0 || genre !== undefined) && <Menu.Root>
      <Menu.Trigger className={styles.select}><ListFilter size={16} aria-hidden="true" />
        {selected?.name ?? (genre ? "Выбранный жанр или тег" : "Жанры и теги")} <ChevronDown size={15} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal><Menu.Content className={styles.menu} align="start" sideOffset={6}>
        <Menu.Item asChild><Link scroll={false} href={catalogHref(sort)}>Все жанры и теги {!genre && <Check size={15} />}</Link></Menu.Item>
        {terms.map(term => <Menu.Item key={term.id} asChild>
          <Link scroll={false} href={catalogHref(sort, term.id)}>{term.name} {genre === term.id && <Check size={15} />}</Link>
        </Menu.Item>)}
      </Menu.Content></Menu.Portal>
    </Menu.Root>}
  </div>;
}

function Empty({ collection, genre, sort }: BrowserFilters & { collection: Collection }) {
  const saved = collection === "me/favorites", history = collection === "me/continue-watching";
  const Icon = saved ? Bookmark : history ? History : Film;
  const title = saved ? "Избранное пока пусто" : history ? "Вы ещё не начали просмотр"
    : genre !== undefined ? "Сериалов с этим фильтром пока нет" : "Сериалы пока не опубликованы";
  const hint = saved ? "Сохраняйте сериалы из их карточек, чтобы вернуться к ним позже."
    : history ? "Начатые серии появятся здесь вместе с сохранённой позицией." : "";
  return <div className={styles.empty}>
    <Icon strokeWidth={1.5} size={25} aria-hidden="true" />
    <div><strong>{title}</strong>{hint && <p>{hint}</p>}</div>
    {genre !== undefined && <ActionLink className={styles.emptyLink} href={catalogHref(sort)}>Сбросить фильтр</ActionLink>}
    {(saved || history) && <ActionLink className={styles.emptyLink} href="/catalog">В каталог</ActionLink>}
  </div>;
}

type GalleryProps = BrowserFilters & { collection: Collection; onDetails: (card: Card) => void; guest: boolean; viewerId: string };
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

function GalleryResults({ collection, sort, genre, onDetails, guest, viewerId, page }: GalleryProps & { page: GalleryPage }) {
  const { container, cards } = useSeriesCardDetails<HTMLUListElement>(page.items, onDetails);
  return <>
    {page.items.length > 0 && <ul ref={container} className={collection === "me/continue-watching" ? styles.historyGrid : styles.grid}>
      {page.items.map(item => <li key={item.id} data-series={item.id}><SeriesCard item={item} card={cards[item.id]} guest={guest} viewerId={viewerId} variant={collection === "me/continue-watching" ? "continue" : "poster"} /></li>)}
    </ul>}
    {page.busy && <div className={styles.loading}><SonaLoader label={page.items.length ? "Загружаем ещё сериалы" : "Загружаем сериалы"} /></div>}
    {page.error && <div className={styles.empty} role="alert"><div><strong>Не удалось загрузить сериалы</strong><p>{page.error}</p></div><Button className={styles.emptyLink} onClick={page.retry}>Повторить</Button></div>}
    {!page.busy && !page.error && !page.items.length && !page.next && <Empty collection={collection} sort={sort} genre={genre} />}
    {!page.busy && !page.error && page.next && <Button className={styles.more} onClick={page.more}>Показать ещё</Button>}
  </>;
}

export function CatalogPage({ initialCollection: collection, title = "Каталог", embedded = false, sort = "new", genre }: {
  initialCollection: Collection;
  title?: string;
  embedded?: boolean;
  sort?: CatalogSort;
  genre?: number;
}) {
  const { me, error: sessionError, reload } = useSession();
  const [terms, setTerms] = useState<CatalogTerm[]>([]);
  const browse = collection === "catalog";
  const onDetails = useCallback((card: Card) => {
    if (!browse) return;
    setTerms(current => {
      const terms = new Map(current.map(term => [term.id, term]));
      for (const term of [...card.genres, ...card.tags]) terms.set(term.id, term);
      if (terms.size === current.length && current.every(term => term.name === terms.get(term.id)?.name)) return current;
      return [...terms.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    });
  }, [browse]);
  const ActiveGallery = collection === "me/favorites" ? FavoritesGallery : Gallery;
  const content = <>
    {browse && <CatalogFilters sort={sort} genre={genre} terms={terms} />}
    {sessionError ? <div className={styles.empty} role="alert"><strong>{sessionError}</strong><Button onClick={reload}>Повторить</Button></div>
      : !me ? <div className={styles.loading}><SonaLoader label="Загружаем сериалы" /></div> : <ActiveGallery key={JSON.stringify([me.id, me.role, me.locale, collection, sort, genre])}
        collection={collection} sort={sort} genre={genre} onDetails={onDetails} guest={me.role === "guest"} viewerId={me.id} />}
  </>;
  if (embedded) return <section id="catalog" className={styles.embedded} aria-labelledby="catalog-title">
    <div className={styles.heading}><h2 id="catalog-title" className="section-title">{title}</h2></div>{content}
  </section>;
  return <InteriorPage id="catalog" title={title} back={browse ? { href: "/", label: "Главная" } : { href: "/profile", label: "Профиль" }}>
    {content}
  </InteriorPage>;
}
