import assert from "node:assert/strict";
import { test } from "node:test";
import { getContent, setContentIdentity } from "../src/shared/api/content";
import { getSonaQueryClient } from "../src/shared/api/query-client";

test("a cancelled reader leaves its peer connected, cached data is scoped to the viewer", async t => {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  t.after(() => { getSonaQueryClient().clear(); Reflect.deleteProperty(globalThis, "window"); });
  let complete!: () => void;
  let signal: AbortSignal | undefined;
  const fetcher = t.mock.method(globalThis, "fetch", async (_url: string, request: RequestInit) => {
    signal = request.signal ?? undefined;
    return new Promise<Response>(resolve => { complete = () => resolve(Response.json({ title: "SONA" })); });
  });
  const first = new AbortController();
  const a = getContent("series/1", first.signal);
  const b = getContent("series/1");
  assert.equal(fetcher.mock.callCount(), 1);
  first.abort();
  await assert.rejects(a, { name: "AbortError" });
  assert.equal(signal?.aborted, false);
  complete();
  assert.deepEqual(await b, { title: "SONA" });
  assert.deepEqual(await getContent("series/1"), { title: "SONA" });
  assert.equal(fetcher.mock.callCount(), 1);
  setContentIdentity();
  const afterChange = getContent("series/1");
  assert.equal(fetcher.mock.callCount(), 2);
  complete();
  await afterChange;
});
