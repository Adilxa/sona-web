import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicSeries } from "../src/shared/seo/catalog.server";
import { seriesDescription, seriesJsonLd } from "../src/shared/seo/series-metadata";

const local = createRequire(import.meta.url);
local.extensions[".css"] = module => { module.exports = {}; };
const { SeriesDetailsPage } = local("../src/_pages/series-details") as typeof import("../src/_pages/series-details");

const series: PublicSeries = {
  id: 29, slug: "into-orbit", title: "Into Orbit", description: "An engineer returns to an abandoned station.",
  genres: ["Drama"], lang: "en", episodesCount: 0, image: "https://art.sona.invalid/poster.webp",
};

test("the initial series HTML includes the actual synopsis before starting a viewer session", () => {
  const html = renderToStaticMarkup(createElement(SeriesDetailsPage, { id: "29", episode: 0, at: 0, summary: series }));
  assert.equal(html.match(/<h1\b/g)?.length, 1);
  assert.ok(html.includes(series.title));
  assert.equal(html.split(series.description).length - 1, 1);
  assert.ok(html.includes("Drama") && html.includes(series.image!));
  assert.ok(!/<video|\.m3u8|бесплатно/i.test(html));
});

test("series structured data protects its surrounding script and uses only published facts", () => {
  const injected = { ...series, description: "</script><script>updated</script>", signedPlayback: "private fixture", viewerId: "private viewer" };
  const json = seriesJsonLd(injected, "/series/29-into-orbit?lang=en", "https://sona.invalid");
  const schema = JSON.parse(json);
  assert.ok(!json.includes("<") && !json.includes("private"));
  assert.equal(schema["@type"], "TVSeries");
  assert.equal(schema.url, "https://sona.invalid/series/29-into-orbit?lang=en");
  assert.equal(schema["@id"], schema.url + "#series");
  assert.equal(schema.numberOfEpisodes, 0);
  assert.equal(schema.description, injected.description);
  assert.ok(!("offers" in schema) && !("isAccessibleForFree" in schema));
  const sparse = JSON.parse(seriesJsonLd({ ...series, image: undefined, genres: [], description: "" }, "/series/29-into-orbit"));
  for (const key of ["url", "@id", "description", "genre", "image"]) assert.ok(!(key in sparse), key);
});

test("empty synopses still get a factual series-specific description in both languages", () => {
  assert.equal(seriesDescription(series, "en"), series.description);
  assert.equal(seriesDescription({ ...series, description: "" }, "ru"), "Into Orbit · Drama · Серий: 0");
  assert.equal(seriesDescription({ ...series, description: "", episodesCount: 1 }, "en"), "Into Orbit · Drama · 1 episode");
  assert.equal(seriesDescription({ ...series, description: "", episodesCount: 2 }, "en"), "Into Orbit · Drama · 2 episodes");
});

test("only the search snippet is shortened for a long synopsis", () => {
  const description = "A pilot follows the signal across the sky. ".repeat(12).trim();
  const data = { ...series, description };
  const snippet = seriesDescription(data, "en");
  assert.ok(snippet.length <= 180 && snippet.endsWith("…"));
  assert.equal(description[snippet.length - 1], " ");
  assert.equal(JSON.parse(seriesJsonLd(data, "/series/29-into-orbit")).description, description);
});
