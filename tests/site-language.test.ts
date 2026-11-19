import assert from "node:assert/strict";
import test from "node:test";
import { resolveLocale } from "../src/shared/i18n/model";
import { localizedPath, loginDestination, parseSeriesSegment, seriesPath } from "../src/shared/seo/urls";
import { getContent, setContentIdentity } from "../src/shared/api/content";
import { getSonaQueryClient } from "../src/shared/api/query-client";

test("a supported cookie wins; otherwise negotiate the browser's first supported language", () => {
  assert.equal(resolveLocale("en", "ru"), "en");
  assert.equal(resolveLocale("fr", "de,ru;q=0.7,en-GB;q=0.9"), "en");
  assert.equal(resolveLocale(undefined, "en;q=0,ru-RU"), "ru");
  assert.equal(resolveLocale(undefined, "ru;q=0.01,en;q=oops"), "ru");
  assert.equal(resolveLocale(undefined, "fr"), "ru");
});

test("public URLs keep a validated series id and a single explicit language", () => {
  assert.equal(parseSeriesSegment("2147483647-demo"), 2147483647);
  assert.equal(parseSeriesSegment("2147483648-demo"), null);
  assert.equal(parseSeriesSegment("5/episode"), null);
  assert.equal(seriesPath(42, "two-worlds"), "/series/42-two-worlds");
  assert.equal(seriesPath(42, "bad/slug"), "/series/42");
  assert.equal(localizedPath("/catalog?genre=7&lang=ru", "en"), "/catalog?genre=7&lang=en");
});

test("return from sign-in to a localized episode preserves playback parameters", () => {
  const episode = "/series/42-two-worlds?episode=59&at=12&lang=en";
  assert.equal(loginDestination(episode), episode);
  assert.equal(loginDestination("/series/42?episode=59&at=0"), "/series/42?episode=59&at=0");
  assert.equal(loginDestination("/series/42-two-worlds?play=1&next=elsewhere"), "/series/42-two-worlds?play=1");
  assert.equal(loginDestination("/wallet"), "/wallet");
  assert.equal(loginDestination("//other.example"), "/profile");
  assert.equal(loginDestination("/series/3/extra"), "/profile");
});

test("the catalog cache separates languages; an explicit content language takes precedence", async t => {
  const root = { lang: "en" };
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "document", { value: { documentElement: root }, configurable: true });
  t.after(() => {
    setContentIdentity();
    getSonaQueryClient().clear();
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "window");
  });
  const fetcher = t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) =>
    Response.json(new Headers(init.headers).get("Accept-Language")));
  assert.equal(await getContent("series/7"), "en");
  root.lang = "ru";
  assert.equal(await getContent("series/7"), "ru");
  root.lang = "en";
  assert.equal(await getContent("series/7"), "en");
  assert.equal(fetcher.mock.callCount(), 2);
  setContentIdentity({locale: "fr"} as Parameters<typeof setContentIdentity>[0]);
  assert.equal(await getContent("series/7"), "fr");
});
