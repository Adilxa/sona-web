import assert from "node:assert/strict";
import test from "node:test";
import { episodeSwipe, mediaTime, reelDirection, reelOffset, releaseVelocity, wallCanScroll, wallScrollEdge } from "../src/_pages/series-details/ui/player-gesture";

test("only intentional vertical flicks select an adjacent episode", () => {
  const origin = { x: 20, y: 150, time: 1000 };
  const end = (x: number, y: number, time = 1220) => ({ x, y, time });
  assert.equal(episodeSwipe(origin, end(25, 60)), 1);
  assert.equal(episodeSwipe(origin, end(5, 240)), -1);
  assert.equal(episodeSwipe(origin, end(20, 130)), 0);
  assert.equal(episodeSwipe(origin, end(100, 60)), 0);
  assert.equal(episodeSwipe(origin, end(20, 60, 2200)), 0);
});

test("time labels tolerate missing duration, fragments and fractional positions", () => {
  assert.equal(mediaTime(NaN), "0:00");
  assert.equal(mediaTime(Infinity), "0:00");
  assert.equal(mediaTime(-7), "0:00");
  assert.equal(mediaTime(63.91), "1:03");
});

test("a reel follows the finger, resists at either boundary and never exposes a second neighbor", () => {
  assert.equal(reelOffset(-116,700,true,true),-116);
  assert.equal(reelOffset(116,700,true,true),116);
  assert.equal(reelOffset(-2300,700,false,true),-700);
  assert.ok(reelOffset(200,700,false,true) > 0 && reelOffset(200,700,false,true) < 100);
  assert.equal(reelOffset(-200,700,true,false),-reelOffset(200,700,false,true));
});

test("distance and final velocity decide a reel release independently, including reversals", () => {
  assert.equal(reelDirection(-115,700,-.15),0);
  assert.equal(reelDirection(-115,700,-.57),1);
  assert.equal(reelDirection(250,700,0),-1);
  assert.equal(reelDirection(-250,700,+.6),0);
  assert.equal(reelDirection(6,700,-.8),0);
  assert.equal(reelDirection(100,700,.7),-1);
});

test("a fast direction change near release outweighs an earlier stroke and holding dissipates velocity", () => {
  const samples = [{ y: 280, time: 0 }, { y: 180, time: 40 }, { y: 150, time: 65 }, { y: 170, time: 90 }];
  assert.ok(releaseVelocity(samples,{ y: 180, time: 100 }) > .8);
  assert.equal(releaseVelocity(samples,{ y: 170, time: 270 }),0);
});

test("a deliberate downward swipe across the access wall opens the previous episode on tall phones", () => {
  const heldAtRelease = 0;
  assert.equal(reelDirection(122, 844, heldAtRelease, true), -1);
  assert.equal(reelDirection(12, 844, .7, true), 0);
  assert.equal(reelDirection(45, 844, .05, true), 0);
  assert.equal(reelDirection(122, 844, -.5, true), 0);
  assert.equal(reelDirection(122, 844, heldAtRelease), 0);
});

test("the access card scrolls natively when it has more content in the gesture direction", () => {
  const edge = (top: number, content = 570) => wallScrollEdge({ clientHeight: 270, scrollHeight: content, scrollTop: top });
  assert.equal(edge(0, 270), "none");
  assert.equal(wallCanScroll(edge(0, 270), 125), false);
  assert.equal(wallCanScroll(edge(-.4), 125), false);
  assert.equal(wallCanScroll(edge(0), -125), true);
  assert.equal(wallCanScroll(edge(130), 125), true);
  assert.equal(wallCanScroll(edge(130), -125), true);
  assert.equal(wallCanScroll(edge(299.7), 125), true);
  assert.equal(wallCanScroll(edge(301), -125), false);
});
