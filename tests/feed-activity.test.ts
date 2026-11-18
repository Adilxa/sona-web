import assert from "node:assert/strict";
import test from "node:test";
import { FeedActivity, type FeedItem } from "../src/_pages/feed/activity";
import { retainFeedVideo, waitForFeedVisibility } from "../src/_pages/feed/network";
import type { components } from "../src/shared/api/schema";

type Event = components["schemas"]["EventInput"];
const first: FeedItem = { kind: "series", series_id: 1, first_episode_id: 11, title: "Первый", slug: "first" };
const second: FeedItem = { kind: "series", series_id: 2, first_episode_id: 22, title: "Второй", slug: "second" };

test("a feed visit counts only visible playing time and attributes a swipe to the departed series", async () => {
  const events: Event[] = [];
  let clock = 0;
  const activity = new FeedActivity(async batch => { events.push(...batch); }, () => clock);
  activity.show(first);
  activity.show(first);
  activity.play(1);
  clock = 2150;
  activity.pause(1);
  clock = 12150;
  activity.play(1);
  clock = 13150;
  activity.complete(1);
  activity.complete(1);
  activity.show(second);
  activity.play(2);
  activity.pause(1);
  activity.action(first, "share");
  clock += 1250;
  activity.pause(2);
  await activity.flush();
  assert.deepEqual(events.map(event => [event.type, event.series_id, event.value]), [
    ["impression", 1, undefined], ["play_start", 1, undefined], ["watch_time", 1, 2],
    ["complete", 1, undefined], ["watch_time", 1, 1], ["swipe_away", 1, 3],
    ["impression", 2, undefined], ["play_start", 2, undefined], ["share", 1, undefined], ["watch_time", 2, 1],
  ]);
  assert.equal(new Set(events.map(event => event.event_id)).size, events.length);
});

test("concurrent drains preserve new events and respect the 100-event API limit", async () => {
  const batches: Event[][] = [];
  let resume = () => {};
  const hold = new Promise<void>(resolve => { resume = resolve; });
  const activity = new FeedActivity(async batch => { batches.push(batch); await hold; });
  for (let i = 0; i < 105; i++) activity.action(first, "share");
  const flush = activity.flush();
  activity.action(second, "like");
  await activity.flush();
  resume();
  await flush;
  assert.deepEqual(batches.map(batch => batch.length), [100, 6]);
  assert.equal(batches[1].at(-1)?.series_id, 2);
});

test("completion counts distinct visible intervals even when the native video keeps playing in the background", async () => {
  const events: Event[] = [];
  const activity = new FeedActivity(async batch => { events.push(...batch); });
  activity.show(first);
  activity.play(first.series_id);
  const sample = (...segments: [number, number][]) => ({
    duration: 100, played: { length: segments.length, start: (i: number) => segments[i][0], end: (i: number) => segments[i][1] },
  });
  activity.observePlayback(first.series_id, sample([0, 10], [98, 100]), 0, 10);
  activity.observePlayback(first.series_id, sample([0, 90]), 85, 90);
  activity.observePlayback(first.series_id, sample([0, 90]), 0, 50);
  activity.observePlayback(first.series_id, sample([0, 90]), 0, 50);
  await activity.flush();
  assert.equal(events.filter(event => event.type === "complete").length, 0);
  activity.observePlayback(first.series_id, sample([0, 90]), 45, 90);
  activity.observePlayback(first.series_id, sample([0, 100]), 90, 100);
  await activity.flush();
  assert.equal(events.filter(event => event.type === "complete").length, 1);
});

test("a hidden feed keeps an attached reel and defers new media and cursor requests until visible", async () => {
  assert.equal(retainFeedVideo("auto", false, false), true);
  assert.equal(retainFeedVideo("hidden", false, true), true);
  assert.equal(retainFeedVideo("hidden", true, false), false);
  assert.equal(retainFeedVideo("manual", false, false), false);
  assert.equal(retainFeedVideo("manual", true, false), true);

  const page = Object.assign(new EventTarget(), { hidden: true });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: page });
  try {
    const exit = new AbortController();
    let requests = 0;
    const visible = waitForFeedVisibility(exit.signal).then(() => { requests++; });
    const stale = new AbortController();
    const abandoned = waitForFeedVisibility(stale.signal).then(() => { requests++; });
    stale.abort();
    await assert.rejects(abandoned, { name: "AbortError" });
    assert.equal(requests, 0);
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    await visible;
    assert.equal(requests, 1);
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
