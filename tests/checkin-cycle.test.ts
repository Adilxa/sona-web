import assert from "node:assert/strict";
import test from "node:test";
import { checkinCycle } from "../src/_pages/account/checkin-cycle";

const history = [2, 1, 7, 6].map((day_index, i) => ({ date: `2026-11-${18 - i}`, day_index }));
const available = { current_day_index: 3, today_checked_in: false, today_reward_coins: 8, days: history };

test("the seven-day strip marks server records from the current cycle", () => {
  assert.deepEqual([...checkinCycle(available).marked], [2, 1]);
  assert.deepEqual([...checkinCycle({ ...available, current_day_index: 1 }).marked], []);
  assert.deepEqual([...checkinCycle({ ...available, days: [] }).marked], []);
});

test("an already-claimed check-in shows its state without reporting a zero award", () => {
  const status = { ...available, today_checked_in: true, today_reward_coins: 0, days: [{ date: "2026-11-19", day_index: 3 }, ...history] };
  const cycle = checkinCycle(status);
  assert.equal(cycle.checked, true);
  assert.deepEqual([...cycle.marked], [3, 2, 1]);
  assert.equal(cycle.awarded, undefined);
  assert.equal(checkinCycle(status, { day_index: 3, reward_coins: 0, already_checked_in: true }).awarded, undefined);
});

test("only the successful server receipt determines the amount credited", () => {
  const result = checkinCycle(available, { day_index: 3, already_checked_in: false, reward_coins: 13 });
  assert.equal(result.awarded, 13);
  assert.equal(result.checked, true);
  assert.ok(result.marked.has(3));
  assert.equal(checkinCycle(available).awarded, undefined);
});

test("an authoritative receipt from a new cycle cannot import days from a stale status", () => {
  const cycle = checkinCycle(available, { day_index: 1, already_checked_in: false, reward_coins: 2 });
  assert.equal(cycle.day, 1);
  assert.deepEqual([...cycle.marked], [1]);
});
