import type { components, operations } from "@/shared/api/schema";
import type { requestSona } from "@/shared/api/sona.server";
import type { Locale } from "@/shared/i18n/model";

type Schema = components["schemas"];
export type PublicSeriesBrief = Pick<Schema["SeriesBrief"], "id" | "slug" | "title">;
export type PublicSeries = PublicSeriesBrief & {
  description: string;
  lang: string;
  genres: string[];
  episodesCount: number;
  image?: string;
};

type Page = { items: PublicSeriesBrief[]; next: string | null };
type Sort = NonNullable<NonNullable<operations["browseCatalog"]["parameters"]["query"]>["sort"]>;
type CatalogCard = { series: PublicSeries; terms: Map<number, string> };
type Access = { token: string; expires: number };
const ttl = 60_000;
const timeout = 4_000;
const maxPages = 5_000;

function readCache<T>(limit: number, now: () => number) {
  const values = new Map<string, { value: T; expires: number }>();
  const flights = new Map<string, Promise<T>>();
  return (key: string, read: () => Promise<T>): Promise<T> => {
    const entry = values.get(key);
    if (entry && entry.expires > now()) return Promise.resolve(entry.value);
    values.delete(key);
    const pending = flights.get(key);
    if (pending) return pending;
    const request = read().then(value => {
      if (value !== null) {
        if (values.size >= limit) values.delete(values.keys().next().value!);
        values.set(key, { value, expires: now() + ttl });
      }
      return value;
    }).finally(() => flights.delete(key));
    flights.set(key, request);
    return request;
  };
}

function positiveId(value: number) {
  return Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
}

function brief(row: PublicSeriesBrief): PublicSeriesBrief {
  if (!row || !positiveId(row.id) || typeof row.slug !== "string" || typeof row.title !== "string") {
    throw new Error("Invalid public series summary");
  }
  return { id: row.id, slug: row.slug, title: row.title };
}

function imageOf(card: Schema["SeriesCard"]) {
  // The contract exposes public, immutable image variants. Never publish signed URLs in metadata.
  for (const cover of [card.cover_horizontal, card.cover_vertical]) {
    const variants = [...(cover?.urls ?? [])].sort((a, b) => b.width - a.width);
    for (const { url } of variants) {
      if (!URL.canParse(url)) continue;
      const image = new URL(url);
      if (image.protocol === "https:" && !image.username && !image.password && !image.search && !image.hash &&
          /\.(?:jpe?g|webp|png|avif)$/i.test(image.pathname)) return image.href;
    }
  }
}

export function createCatalogReader(transport: typeof requestSona, deviceId: string, now: () => number = Date.now) {
  let session: Access | undefined;
  let signingIn: Promise<Access> | undefined;
  const seriesCache = readCache<CatalogCard | null>(256, now);
  const pageCache = readCache<Page>(128, now);
  const catalogs = readCache<PublicSeriesBrief[]>(2, now);

  async function signIn(): Promise<Access> {
    if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(deviceId)) throw new Error("Invalid catalog installation UUID");
    const body: Schema["GuestRequest"] = { device_id: deviceId, platform: "web", timezone: "UTC" };
    const response = await transport("/v1/auth/guest", { method: "POST", body, signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new Error(`Catalog guest session failed (${response.status})`);
    const pair: Schema["TokenPair"] = await response.json();
    const expires = Date.parse(pair.access_expires_at);
    if (pair.role !== "guest" || !pair.access_token || !Number.isFinite(expires) || expires <= now()) {
      throw new Error("Invalid catalog guest session");
    }
    return (session = { token: pair.access_token, expires });
  }

  async function access() {
    if (session && session.expires > now() + timeout) return session;
    signingIn ??= signIn().finally(() => { signingIn = undefined; });
    return signingIn;
  }

  async function get(path: "/v1/catalog" | `/v1/series/${number}`, language: Locale, query?: URLSearchParams) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await access();
      const response = await transport(path, { accessToken: current.token, language, query, signal: AbortSignal.timeout(timeout) });
      if (response.status !== 401) return response;
      await response.body?.cancel();
      if (session === current) session = undefined;
    }
    throw new Error("Public catalog authorization failed (401)");
  }

  function page(locale: Locale, genre: number | undefined, sort: Sort, cursor?: string) {
    return pageCache(JSON.stringify([locale, genre, sort, cursor]), async () => {
      const query = new URLSearchParams({ sort });
      if (genre !== undefined) {
        if (!positiveId(genre)) throw new Error("Invalid genre id");
        query.set("genre", String(genre));
      }
      if (cursor) query.set("cursor", cursor);
      const response = await get("/v1/catalog", locale, query);
      if (!response.ok) throw new Error(`Public catalog unavailable (${response.status})`);
      const data: Schema["SeriesBriefPage"] = await response.json();
      if (!Array.isArray(data?.items) || typeof data.page?.has_more !== "boolean") throw new Error("Invalid public catalog page");
      const next = data.page.has_more ? data.page.next_cursor : null;
      if (data.page.has_more && (typeof next !== "string" || !next || next.length > 512 || next === cursor)) {
        throw new Error("Invalid public catalog cursor");
      }
      return { items: data.items.map(brief), next: next ?? null };
    });
  }

  function cardRecord(id: number, locale: Locale) {
    return seriesCache(JSON.stringify([id, locale]), async () => {
      if (!positiveId(id)) throw new Error("Invalid series id");
      const response = await get(`/v1/series/${id}`, locale);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Public series unavailable (${response.status})`);
      const card: Schema["SeriesCard"] = await response.json();
      const summary = brief(card);
      if (summary.id !== id || typeof card.description !== "string" || typeof card.lang !== "string" || !Array.isArray(card.genres) ||
          !Number.isInteger(card.episodes_count) || card.episodes_count < 0 || card.genres.some(genre => typeof genre?.name !== "string")) {
        throw new Error("Invalid public series card");
      }
      const image = imageOf(card);
      const terms = new Map<number, string>();
      for (const term of [...card.genres, ...(card.tags ?? [])]) {
        if (positiveId(term?.id) && typeof term.name === "string" && term.name.trim()) terms.set(term.id, term.name);
      }
      return {
        series: { ...summary, description: card.description, lang: card.lang, genres: card.genres.map(genre => genre.name),
          episodesCount: card.episodes_count, ...(image && { image }) },
        terms,
      };
    });
  }

  async function getPublicSeries(id: number, locale: Locale) {
    const record = await cardRecord(id, locale);
    return record ? { ...record.series, genres: [...record.series.genres] } : null;
  }

  async function getPublicTermName(genre: number, locale: Locale, firstId: number) {
    if (!positiveId(genre) || !positiveId(firstId)) return undefined;
    return (await cardRecord(firstId, locale))?.terms.get(genre);
  }

  async function getPublicCatalogPage(locale: Locale, genre?: number, sort: Sort = "new") {
    return (await page(locale, genre, sort)).items.map(item => ({ ...item }));
  }

  async function getPublicCatalog(locale: Locale) {
    const items = await catalogs(locale, async () => {
      const rows = new Map<number, PublicSeriesBrief>();
      const cursors = new Set<string>();
      let cursor: string | undefined;
      for (let count = 0; count < maxPages; count++) {
        const { items, next } = await page(locale, undefined, "new", cursor);
        for (const item of items) if (!rows.has(item.id)) rows.set(item.id, item);
        if (next === null) return [...rows.values()];
        if (cursors.has(next)) throw new Error("Repeated public catalog cursor");
        cursors.add(next);
        cursor = next;
      }
      throw new Error("Public catalog pagination limit exceeded");
    });
    return items.map(item => ({ ...item }));
  }

  return { getPublicSeries, getPublicCatalog, getPublicCatalogPage, getPublicTermName };
}
