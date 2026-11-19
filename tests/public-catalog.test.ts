import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogReader } from "../src/shared/seo/catalog-reader";
import type { requestSona } from "../src/shared/api/sona.server";

const device = "65028ef2-c07d-49b9-8f92-afe57415e1b6";
const epoch = Date.UTC(2026, 10, 20);
const token = (n: number, now = epoch) => Response.json({ role: "guest", access_token: `guest-${n}`,
  access_expires_at: new Date(now + 15 * 60_000).toISOString(), refresh_token: "unused" });
const row = (id: number, language = "ru") => ({ id, slug: `show-${id}`, title: `${language} ${id}`, is_vip: true });
const full = (id: number, language?: string) => ({ ...row(id, language), lang: language, description: "Synopsis", episodes_count: 7,
  genres: [{ id: 5, name: "Drama" }], cover_horizontal: { urls: [
    { width: 1600, url: "https://media.example/asset.mp4" }, { width: 1200, url: "https://media.example/cover.jpeg?token=one" },
    { width: 900, url: "https://user:pass@media.example/image.jpg" }, { width: 800, url: "https://media.example/image.jpg" },
  ] }, playback_url: "private-playback-url", unlock_options: ["coins"], favorite: true, user_id: "private" });

test("one anonymous installation signs in for concurrent catalog/series reads and only public fields enter locale caches", async () => {
  let now = epoch, sessions = 0, cards = 0, pages = 0;
  const transport: typeof requestSona = async (path, options = {}) => {
    assert.ok(options.signal instanceof AbortSignal);
    if (path === "/v1/auth/guest") {
      assert.equal(options.method, "POST"); assert.equal(options.accessToken, undefined);
      assert.deepEqual(options.body, { device_id: device, platform: "web", timezone: "UTC" });
      return token(++sessions, now);
    }
    assert.equal(options.accessToken, `guest-${sessions}`); assert.equal(options.body, undefined);
    if (path === "/v1/catalog") { pages++; return Response.json({ items: [row(1)], page: { has_more: false } }); }
    assert.equal(path, "/v1/series/1"); cards++;
    return Response.json(full(1, options.language));
  };
  const reader = createCatalogReader(transport, device, () => now);
  const [first, peer, other, index] = await Promise.all([reader.getPublicSeries(1, "ru"), reader.getPublicSeries(1, "ru"),
    reader.getPublicSeries(1, "en"), reader.getPublicCatalog("ru")]);
  assert.equal(sessions, 1); assert.equal(cards, 2); assert.equal(pages, 1);
  assert.deepEqual(first, { id: 1, slug: "show-1", title: "ru 1", lang: "ru", description: "Synopsis", genres: ["Drama"], episodesCount: 7, image: "https://media.example/image.jpg" });
  assert.deepEqual(peer, first); assert.equal(other?.title, "en 1");
  assert.deepEqual(index, [{ id: 1, slug: "show-1", title: "ru 1" }]);
  await reader.getPublicCatalogPage("ru"); assert.equal(pages, 1);
  now += 65_000;
  await reader.getPublicSeries(1, "ru"); assert.equal(cards, 3); assert.equal(sessions, 1);
  now += 15 * 60_000;
  await reader.getPublicSeries(1, "ru"); assert.equal(sessions, 2);
});

test("401 retries share a new session and stop after one retry; outages and missing records can recover", async () => {
  let sessions = 0, reads = 0, status = 200;
  const reader = createCatalogReader(async (path, options = {}) => {
    if (path === "/v1/auth/guest") return token(++sessions);
    reads++;
    if (options.accessToken === "guest-1") return new Response(null, { status: 401 });
    if (status !== 200) return new Response(null, { status });
    return Response.json(full(Number(path.split("/").at(-1)), options.language));
  }, device, () => epoch);
  await Promise.all([reader.getPublicSeries(1, "en"), reader.getPublicSeries(2, "en")]);
  assert.equal(sessions, 2); assert.equal(reads, 4);
  status = 401; await assert.rejects(reader.getPublicSeries(3, "en"), /401/); assert.equal(reads, 6);
  status = 503; await assert.rejects(reader.getPublicSeries(3, "en"), /503/);
  status = 404; assert.equal(await reader.getPublicSeries(3, "en"), null);
  status = 200; assert.equal((await reader.getPublicSeries(3, "en"))?.id, 3);
  await assert.rejects(reader.getPublicSeries(0, "en"), /Invalid series id/);
});

test("catalog pagination keeps opaque cursors, genre and language separate, deduplicates titles and rejects malformed loops", async () => {
  const cursor = "opaque +/=&";
  const calls: string[] = [];
  const reader = createCatalogReader(async (path, options = {}) => {
    if (path === "/v1/auth/guest") return token(1);
    assert.equal(path, "/v1/catalog");
    const next = options.query?.get("cursor"), genre = options.query?.get("genre");
    calls.push(JSON.stringify([options.language, genre, next]));
    const data = genre ? { items: [row(9)], page: { has_more: false } }
      : !next ? { items: [row(1)], page: { has_more: true, next_cursor: cursor } }
      : options.language === "en" ? { items: [], page: { has_more: true, next_cursor: next === cursor ? "two" : cursor } }
      : { items: [row(1), row(2)], page: { has_more: false } };
    return Response.json(data);
  }, device, () => epoch);
  assert.deepEqual((await reader.getPublicCatalogPage("ru", 18)).map(i => i.id), [9]);
  assert.deepEqual((await reader.getPublicCatalogPage("ru")).map(i => i.id), [1]);
  assert.deepEqual((await reader.getPublicCatalog("ru")).map(i => i.id), [1, 2]);
  assert.deepEqual(calls, [["ru", "18", null], ["ru", null, null], ["ru", null, cursor]].map(item => JSON.stringify(item)));
  await assert.rejects(reader.getPublicCatalog("en"), /Repeated public catalog cursor/);
});

test("a non-guest token never reaches the catalog and an upstream catalog 404 is an error", async () => {
  let authorized = false, read = 0;
  const reader = createCatalogReader(async path => {
    if (path === "/v1/auth/guest") return authorized ? token(2) : Response.json({ ...(await token(1).json()), role: "user" });
    read++;
    return new Response(null, { status: 404 });
  }, device, () => epoch);
  await assert.rejects(reader.getPublicCatalog("ru"), /Invalid catalog guest/); assert.equal(read, 0);
  authorized = true; await assert.rejects(reader.getPublicCatalog("ru"), /404/); assert.equal(read, 1);
});

test("SEO filters share one series read with metadata, retain the upstream names and partition sort/genre/locale", async () => {
  const calls = new Map<string, number>();
  const reader = createCatalogReader(async (path, options = {}) => {
    if (path === "/v1/auth/guest") return token(1);
    const sort = options.query?.get("sort"), genre = options.query?.get("genre");
    const key = [path, options.language, genre, sort].join("/");
    calls.set(key, (calls.get(key) ?? 0) + 1);
    if (path === "/v1/catalog") return Response.json({ items: [row(sort === "popular" ? 2 : 1, options.language)], page: { has_more: false } });
    if (path.endsWith("/404")) return new Response(null, { status: 404 });
    return Response.json({ ...full(2, options.language), genres: [{ id: 5, name: options.language === "en" ? "Drama" : "Драма" }],
      tags: [{ id: 15, name: options.language === "en" ? "Slow burn" : "Медленное сближение" }] });
  }, device, () => epoch);
  const [latest, explicit, popular, otherGenre] = await Promise.all([
    reader.getPublicCatalogPage("en", 15), reader.getPublicCatalogPage("en", 15, "new"),
    reader.getPublicCatalogPage("en", 15, "popular"), reader.getPublicCatalogPage("en", 5, "popular"),
  ]);
  assert.deepEqual(latest, explicit); assert.equal(latest[0].id, 1); assert.equal(popular[0].id, 2); assert.equal(otherGenre[0].id, 2);
  assert.equal(calls.get("/v1/catalog/en/15/new"), 1); assert.equal(calls.get("/v1/catalog/en/15/popular"), 1);
  assert.equal(calls.get("/v1/catalog/en/5/popular"), 1);
  const [series, name, tag, absent, other] = await Promise.all([reader.getPublicSeries(2, "en"),
    reader.getPublicTermName(5, "en", 2), reader.getPublicTermName(15, "en", 2), reader.getPublicTermName(8, "en", 2),
    reader.getPublicTermName(15, "ru", 2)]);
  assert.deepEqual(series?.genres, ["Drama"]); assert.equal(name, "Drama"); assert.equal(tag, "Slow burn");
  assert.equal(absent, undefined); assert.equal(other, "Медленное сближение");
  assert.equal(calls.get("/v1/series/2/en//"), 1); assert.equal(calls.get("/v1/series/2/ru//"), 1);
  series!.genres.length = 0;
  latest[0].title = "Local page title";
  const sitemapRows = await reader.getPublicCatalog("en");
  sitemapRows.length = 0;
  assert.deepEqual((await reader.getPublicSeries(2, "en"))?.genres, ["Drama"]);
  assert.equal((await reader.getPublicCatalogPage("en", 15))[0].title, "en 1");
  assert.equal((await reader.getPublicCatalog("en")).length, 1);
  assert.equal(await reader.getPublicTermName(8, "ru", 404), undefined);
});

test("term lookups reuse bounded per-card storage and page filters age out of the bounded page cache", async () => {
  let pages = 0, cards = 0;
  const reader = createCatalogReader(async (path, options = {}) => {
    if (path === "/v1/auth/guest") return token(1);
    if (path === "/v1/catalog") { pages++; return Response.json({ items: [], page: { has_more: false } }); }
    cards++; return Response.json(full(Number(path.split("/").at(-1)), options.language));
  }, device, () => epoch);
  for (let id = 1; id <= 257; id++) await reader.getPublicTermName(5, "en", id);
  assert.equal(cards, 257);
  await reader.getPublicSeries(257, "en"); assert.equal(cards, 257);
  await reader.getPublicSeries(1, "en"); assert.equal(cards, 258);
  for (let genre = 1; genre <= 129; genre++) await reader.getPublicCatalogPage("ru", genre);
  await reader.getPublicCatalogPage("ru", 129); assert.equal(pages, 129);
  await reader.getPublicCatalogPage("ru", 1); assert.equal(pages, 130);
});

test("a timed-out transport rejects shared readers and the next call can recover", async t => {
  let waiting!: () => void;
  const started = new Promise<void>(resolve => { waiting = resolve; });
  const deadlines: AbortController[] = [];
  t.mock.method(AbortSignal, "timeout", (ms: number) => {
    assert.equal(ms, 4_000);
    const controller = new AbortController(); deadlines.push(controller); return controller.signal;
  });
  let reads = 0;
  const reader = createCatalogReader(async (path, options = {}) => {
    if (path === "/v1/auth/guest") return token(1);
    if (++reads > 1) return Response.json(full(1, "en"));
    waiting();
    return new Promise<Response>((_resolve, reject) => options.signal!.addEventListener("abort", () => reject(options.signal!.reason), { once: true }));
  }, device, () => epoch);
  const both = Promise.allSettled([reader.getPublicTermName(5, "en", 1), reader.getPublicSeries(1, "en")]);
  await started; assert.equal(deadlines.length, 2);
  deadlines[1].abort(new DOMException("Deadline", "TimeoutError"));
  for (const result of await both) { assert.equal(result.status, "rejected"); assert.equal(result.reason.name, "TimeoutError"); }
  assert.equal(await reader.getPublicTermName(5, "en", 1), "Drama"); assert.equal(reads, 2);
});
