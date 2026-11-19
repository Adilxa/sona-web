import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LanguageProvider } from "../src/shared/i18n/context";
import type { Locale } from "../src/shared/i18n/model";

const local = createRequire(import.meta.url);
local.extensions[".css"] = module => { module.exports = {}; };
const { EpisodeCount } = local("../src/entities/series/ui/episode-count") as typeof import("../src/entities/series/ui/episode-count");
const { CatalogPage } = local("../src/_pages/catalog/ui/catalog-page") as typeof import("../src/_pages/catalog/ui/catalog-page");

function render(locale: Locale, children: ReactElement) {
  const router = { back() {}, forward() {}, push() {}, replace() {}, refresh() {}, prefetch() {}, bfcacheId: "test" };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router },
    createElement(LanguageProvider, { initial: locale, children })));
}

test("episode counters use the selected language’s plural forms and resume numbering", () => {
  for (const [total, ru, en] of [
    [0, "0 серий", "0 episodes"], [1, "1 серия", "1 episode"], [2, "2 серии", "2 episodes"],
    [5, "5 серий", "5 episodes"], [11, "11 серий", "11 episodes"], [21, "21 серия", "21 episodes"],
  ] as const) {
    assert.ok(render("ru", createElement(EpisodeCount, { total })).includes(ru));
    assert.ok(render("en", createElement(EpisodeCount, { total })).includes(en));
  }
  assert.ok(render("en", createElement(EpisodeCount, { current: 2, total: 8 })).includes("Episode 2 of 8"));
  assert.ok(render("ru", createElement(EpisodeCount, { current: 3 })).includes("Серия 3"));
});

test("the embedded catalog localizes filters, loading messages and heading without changing its genre URL", () => {
  const catalog = createElement(CatalogPage, { initialCollection: "catalog", embedded: true, genre: 86 });
  const en = render("en", catalog), ru = render("ru", catalog);
  for (const label of ["All series", "Selected genre or tag", "Loading series", "Popular", "Sort catalog"]) assert.ok(en.includes(label), label);
  for (const label of ["Все сериалы", "Выбранный жанр или тег", "Загружаем сериалы"]) assert.ok(ru.includes(label), label);
  for (const markup of [en, ru]) assert.ok(markup.includes("/catalog?sort=popular&amp;genre=86"));
});
