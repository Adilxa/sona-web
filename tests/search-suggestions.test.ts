import assert from "node:assert/strict";
import test from "node:test";
import { loadCollection, type CatalogTile } from "../src/entities/series/api/catalog";
import { matchCatalogTitles, mergeSearchMatches } from "../src/features/series-search/catalog-suggestions";
import { getSonaQueryClient } from "../src/shared/api/query-client";

const wind: CatalogTile = { id: "3", title: "Пряный ветер судьбы", episodesCount: 8 };
const forest: CatalogTile = { id: "9", title: "Ёлки. 2 часть" };
const pages = [{ items: [wind] }, { items: [wind, forest] }];

test("brief suggestions match word prefixes across pages, punctuation, case and ё", () => {
  for (const query of ["пр", "пря", "пряный", "ВЕТ СУ", "судь вет", "  ВеТ-сУ  "]) {
    assert.deepEqual(matchCatalogTitles(query, pages), [wind], query);
  }
  for (const query of ["2 ч.", "ел", "ЁЛКИ"]) assert.deepEqual(matchCatalogTitles(query, pages), [forest]);
  for (const query of ["неизвестно", "рян", "пр пр", " . "]) assert.deepEqual(matchCatalogTitles(query, pages), []);
});

test("backend ranking wins and matching the same id adds only one option", () => {
  const server = { ...wind, episodesCount: 9 };
  assert.deepEqual(mergeSearchMatches([forest, server], [wind, wind]), [forest, server]);
  assert.deepEqual(mergeSearchMatches([], [wind]), [wind]);
});

test("cancelled keyword replies cannot replace newer matches, shared cursors fetch only briefs", async t => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  t.after(() => { getSonaQueryClient().clear(); Reflect.deleteProperty(globalThis, "window"); });
  const calls: URL[] = [];
  let late!: (response: Response) => void;
  let oldSignal: AbortSignal | null | undefined;
  t.mock.method(globalThis, "fetch", async (path: string, init: RequestInit) => {
    const url = new URL(path, "https://sona.test");
    calls.push(url);
    if (url.searchParams.get("q") === "пр") {
      oldSignal = init.signal;
      return new Promise<Response>(resolve => { late = resolve; });
    }
    if (url.pathname === "/api/content/search") return Response.json({ items: [] });
    assert.equal(url.pathname, "/api/content/catalog");
    return Response.json({ items: [{ id: 3, title: wind.title, episodes_count: 8, is_vip: false }],
      page: { has_more: false } });
  });

  const controller = new AbortController();
  const aborting = loadCollection("catalog", "пр", "", controller.signal, { summariesOnly: true });
  controller.abort();
  await assert.rejects(aborting, { name: "AbortError" });
  assert.equal(oldSignal?.aborted, true);
  const readPage = () => loadCollection("catalog", "", "signed+/=", undefined, { sort: "new", summariesOnly: true });
  const [first, peer, remote] = await Promise.all([readPage(), readPage(),
    loadCollection("catalog", "вет су", "", undefined, { summariesOnly: true })]);
  late(Response.json({ items: [{ id: 99, title: "Устаревший ответ" }] }));
  assert.deepEqual(first, peer);
  assert.deepEqual(mergeSearchMatches(remote.items, matchCatalogTitles("вет су", [first])).map(row => row.id), ["3"]);
  const catalogCalls = calls.filter(url => url.pathname === "/api/content/catalog");
  assert.equal(catalogCalls.length, 1);
  assert.equal(catalogCalls[0].searchParams.get("cursor"), "signed+/=");
  assert.equal(calls.length, 3);
});
