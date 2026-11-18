import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const local = createRequire(import.meta.url);
local.extensions[".css"] = module => { module.exports = {}; };
const { bindPlaybackTab } = local("../src/_pages/series-details/ui/player") as typeof import("../src/_pages/series-details/ui/player");

function fixture(hidden = false) {
  const page = Object.assign(new EventTarget(), { hidden });
  const win = Object.assign(new EventTarget(), { setTimeout, clearTimeout });
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: page },
    window: { configurable: true, value: win },
  });
  const calls: string[] = [];
  const media = new class extends EventTarget {
    paused = true;
    ended = false;
    error = null;
    play() { calls.push("play"); this.paused = false; this.dispatchEvent(new Event("playing")); return Promise.resolve(); }
    pause() { calls.push("pause"); this.paused = true; this.dispatchEvent(new Event("pause")); }
  }();
  const cleanup = bindPlaybackTab(media as unknown as HTMLVideoElement, {
    connect: () => calls.push("connect"), playing: () => calls.push("playing"), leave: () => calls.push("leave"),
    checkpoint: () => calls.push("progress"), suspendLoading: () => calls.push("stopLoad"),
    resumeLoading: () => calls.push("startLoad"),
  });
  const switchTab = (value: boolean) => { page.hidden = value; page.dispatchEvent(new Event("visibilitychange")); };
  const tick = () => new Promise<void>(done => setTimeout(done,5));
  return { calls, media, page, win, switchTab, tick, cleanup };
}

test("the active episode keeps playing and buffering in background, and a media-key pause wins on return", async () => {
  const f = fixture();
  try {
    await f.media.play();
    f.switchTab(true);
    f.media.dispatchEvent(new Event("waiting"));
    f.media.dispatchEvent(new Event("playing"));
    f.switchTab(false);
    await f.tick();
    assert.equal(f.media.paused,false);
    assert.equal(f.calls.filter(c => c === "playing").length,2);
    assert.ok(!f.calls.includes("pause") && !f.calls.includes("stopLoad"));
    f.switchTab(true);
    f.media.pause();
    f.switchTab(false);
    await f.tick();
    assert.equal(f.media.paused,true);
    assert.equal(f.calls.filter(c => c === "play").length,1);
    f.win.dispatchEvent(new Event("pagehide"));
    assert.ok(f.calls.includes("leave") && f.calls.includes("stopLoad"));
  } finally { f.cleanup(); }
});

test("a hidden new episode waits, and only confirmed previously active, silently suspended playback recovers", async () => {
  const f = fixture(true);
  try {
    assert.equal(f.calls.length,0);
    f.switchTab(false);
    assert.ok(f.calls.includes("connect"));
    await f.media.play();
    f.switchTab(true);
    f.page.dispatchEvent(new Event("freeze"));
    f.media.paused = true;
    f.switchTab(false);
    await f.tick();
    assert.equal(f.media.paused,false);
    assert.equal(f.calls.filter(c => c === "play").length,2);
    f.media.pause();
    f.switchTab(true);
    f.switchTab(false);
    await f.tick();
    assert.equal(f.media.paused,true);
    assert.equal(f.calls.filter(c => c === "play").length,2);
  } finally { f.cleanup(); }
});

test("initial autoplay delayed across a switch waits for foreground and navigation cancels recovery", async () => {
  const f = fixture();
  try {
    f.switchTab(true);
    await f.media.play(); // A pending browser autoplay races with visibilitychange.
    assert.equal(f.media.paused,true);
    assert.ok(!f.calls.includes("playing"));
    f.switchTab(false);
    await f.tick();
    assert.equal(f.media.paused,false);
    f.switchTab(true);
    f.media.paused = true;
    f.switchTab(false);
    f.win.dispatchEvent(new Event("pagehide"));
    await f.tick();
    assert.equal(f.media.paused,true);
    assert.equal(f.calls.filter(c => c === "playing").length,1);
  } finally { f.cleanup(); }
});
