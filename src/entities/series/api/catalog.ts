import { uiText } from "@/shared/i18n/model";
import { getContent, SonaError } from "@/shared/api/content";
import type { components, operations } from "@/shared/api/schema";

type Schema = components["schemas"];
type CatalogQuery = NonNullable<operations["browseCatalog"]["parameters"]["query"]>;
export type CatalogSort = NonNullable<CatalogQuery["sort"]>;
export type Collection = "catalog" | "feed" | "me/favorites" | "me/continue-watching";
export type CatalogTerm = Schema["TermRef"];
export type CatalogTile = {
  id: string;
  slug?: string;
  title: string;
  poster?: string;
  episodesCount?: number;
  isVip?: boolean;
  episode?: number;
  episodeNumber?: number;
  position?: number;
  duration?: number;
  completed?: boolean;
};

type CollectionOptions = { sort?: CatalogSort; genre?: number; summariesOnly?: boolean };

function poster(cover: Schema["SeriesCard"]["cover_vertical"]) {
  const urls = cover?.urls ?? [];
  return (urls.find(image => image.width >= 400) ?? urls.at(-1))?.url;
}

export async function findSeries(id: string, signal?: AbortSignal) {
  const card = await getContent<Schema["SeriesCard"]>(`series/${encodeURIComponent(id)}`, signal);
  const landscape = poster(card.cover_horizontal);
  return {
    id: String(card.id),
    slug: card.slug,
    title: card.title,
    description: card.description,
    poster: poster(card.cover_vertical) ?? landscape,
    landscape,
    genres: card.genres ?? [],
    tags: card.tags ?? [],
    episodesCount: card.episodes_count,
    freeEpisodesCount: card.free_episodes_count,
    isVip: card.is_vip,
    releaseState: card.release_state,
  };
}

export async function listEpisodes(id: string, _cursor: string, signal?: AbortSignal) {
  const { items } = await getContent<Schema["EpisodeList"]>(`series/${encodeURIComponent(id)}/episodes`, signal);
  return { items, next: "" };
}

function briefs(items: Schema["SeriesBrief"][]) {
  return items.map(row => ({
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    episodesCount: row.episodes_count,
    isVip: row.is_vip,
  }));
}

function next(page: Schema["PageInfo"]) {
  return page.has_more ? (page.next_cursor ?? "") : "";
}

async function summaries(collection: Collection, query: string, cursor: string, signal: AbortSignal | undefined, options: CollectionOptions): Promise<{items: CatalogTile[]; next: string}> {
  if (query) {
    const data = await getContent<Schema["SeriesBriefList"]>("search?" + new URLSearchParams({ q: query }), signal);
    return { items: briefs(data.items), next: "" };
  }
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (collection === "catalog") {
    if (options.genre !== undefined) params.set("genre", String(options.genre));
    if (options.sort) params.set("sort", options.sort);
    const data = await getContent<Schema["SeriesBriefPage"]>("catalog" + (params.size ? "?" + params : ""), signal);
    return { items: briefs(data.items), next: next(data.page) };
  }
  const path = collection + (params.size ? "?" + params : "");
  if (collection === "feed") {
    const data = await getContent<Schema["FeedPage"]>(path, signal);
    return {
      items: data.items.filter(row => row.kind === "series").map(row => ({
        id: String(row.series_id), slug: row.slug, title: row.title, poster: row.poster_url,
      })),
      next: next(data.page),
    };
  }
  if (collection === "me/continue-watching") {
    const { items } = await getContent<Schema["ContinueWatching"]>(collection, signal);
    return {
      items: items.map(row => ({
        id: String(row.series_id), title: "", episode: row.episode_id, episodeNumber: row.episode_number,
        position: row.position_sec, duration: row.duration_sec, completed: row.completed,
      })),
      next: "",
    };
  }
  const data = await getContent<Schema["FavoritesPage"]>(path, signal);
  return { items: data.items.map(row => ({ id: String(row.series_id), title: "" })), next: next(data.page) };
}

export async function loadCollection(collection: Collection, query: string, cursor: string, signal?: AbortSignal, options: CollectionOptions = {}) {
  const page = await summaries(collection, query, cursor, signal, options);
  if (options.summariesOnly || collection === "feed") return page;
  const items = await Promise.all(page.items.map(async row => {
    try {
      const card = await findSeries(row.id, signal);
      return { ...row, ...card, slug: card.slug || row.slug };
    } catch (err) {
      if (signal?.aborted || (!row.title && !(err instanceof SonaError && err.status === 404))) throw err;
      return { ...row, title: row.title || uiText(`Сериал №${row.id}`, `Series #${row.id}`) };
    }
  }));
  return { items, next: page.next };
}

export function listSeries(cursor: string, signal?: AbortSignal) {
  return loadCollection("catalog", "", cursor, signal);
}

export async function playback(id: string, signal?: AbortSignal) {
  const data = await getContent<Schema["Playback"]>(`episodes/${encodeURIComponent(id)}/playback`, signal);
  if (!data.url || new URL(data.url).protocol !== "https:") throw Error(uiText("Воспроизведение этой серии сейчас недоступно.", "This episode is currently unavailable."));
  return data;
}
