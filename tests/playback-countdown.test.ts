import assert from "node:assert/strict";
import test from "node:test";
import { PlaybackCountdown } from "../src/_pages/series-details/ui/playback-countdown";

test("autoplay requires ten foreground seconds and one transition wins a simultaneous tap", () => {
  const clock = new PlaybackCountdown();
  clock.resume(10);
  assert.equal(clock.left(6010),4000);
  clock.resume(6020);
  clock.pause(6510);
  assert.equal(clock.left(90010),3500);
  clock.resume(90010);
  assert.equal(clock.left(93509),1);
  assert.equal(clock.left(93510),0);
  assert.equal(clock.claim(),true);
  assert.equal(clock.claim(),false);
});
