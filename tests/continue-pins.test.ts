import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { continuePinSnapshot, pinnedFirst, setContinuePin, subscribeContinuePins } from "../src/entities/series/model/continue-pins";
import { favoritesKey } from "../src/entities/series/model/social";

const local = createRequire(import.meta.url);
local.extensions[".css"] = module => { module.exports = {}; };
const { SeriesCard } = local("../src/entities/series/ui/series-card") as typeof import("../src/entities/series/ui/series-card");

test("one corner action per card: pin on resume, favorite on posters and where pinning is unavailable", () => {
  const client = new QueryClient();
  const viewerId = "test-viewer";
  client.setQueryData(favoritesKey(viewerId), []);
  const item = { id: "19", title: "Пряный ветер" };
  for (const [variant, pinned, action] of [
    ["continue", false, "Закрепить"], ["continue", true, "Открепить"],
    ["continue", undefined, "Добавить"], ["poster", undefined, "Добавить"], ["poster", true, "Добавить"],
  ] as const) {
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(SeriesCard, { item, viewerId, variant, pinned })));
    assert.equal(html.match(/<button\b/g)?.length, 1);
    assert.ok(html.includes(`aria-label="${action} «${item.title}»`));
    if (action !== "Добавить") assert.ok(html.includes(`aria-pressed="${pinned}"`));
  }
  client.clear();
});

class TestStorage extends Map<string, string> {
  get length() { return this.size; }
  key(index: number) { return [...this.keys()][index] ?? null; }
  setItem(key: string, value: string) { this.set(key, value); }
  removeItem(key: string) { this.delete(key); }
}

class Tab extends EventTarget {
  constructor(readonly localStorage: TestStorage) { super(); }
  open() { Object.defineProperty(globalThis, "window", { configurable: true, value: this }); }
  storageChanged(key: string | null) {
    this.dispatchEvent(Object.assign(new Event("storage"), { key }));
  }
}

test("two tabs retain independent pins, sync updates per viewer, survive reload, and preserve the history order after unpin", t => {
  const storage = new TestStorage();
  const first = new Tab(storage), second = new Tab(storage);
  t.after(() => Reflect.deleteProperty(globalThis, "window"));
  const viewer = "viewer/a";
  const original = ["9", "3", "8", "7", "4"];
  const history = (id: string) => pinnedFirst(original, new Set<string>(JSON.parse(continuePinSnapshot(id))), row => row);
  first.open();
  let updates = 0, peerUpdates = 0;
  const unsubscribe = subscribeContinuePins(viewer, () => updates++);
  subscribeContinuePins("other", () => peerUpdates++);
  setContinuePin(viewer, "7", true);
  assert.equal(updates, 1);
  second.open();
  assert.deepEqual(history(viewer), ["7", "9", "3", "8", "4"]);
  setContinuePin(viewer, "3", true);
  const remoteChange = storage.key(1);
  setContinuePin("other", "8", true);
  first.open();
  first.storageChanged(remoteChange);
  assert.equal(updates, 2);
  assert.equal(peerUpdates, 0);
  assert.deepEqual(history(viewer), ["3", "7", "9", "8", "4"]);
  assert.deepEqual(history("other"), ["8", "9", "3", "7", "4"]);
  setContinuePin(viewer, "7", false);
  assert.deepEqual(history(viewer), ["3", "9", "8", "7", "4"]);
  new Tab(storage).open();
  assert.deepEqual(history(viewer), ["3", "9", "8", "7", "4"]);
  setContinuePin(viewer, "3", false);
  assert.deepEqual(history(viewer), original);
  assert.deepEqual(history("other"), ["8", "9", "3", "7", "4"]);
  first.open();
  unsubscribe();
  first.storageChanged(null);
  assert.equal(updates, 3);
});
