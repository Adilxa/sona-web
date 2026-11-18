import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { NextRequest } from "next/server";
import * as content from "../app/api/content/[...path]/route";

// The OpenAPI generator already uses js-yaml for this contract.
const yaml = createRequire(import.meta.url)("js-yaml");
const spec: { paths: Record<string, Record<string, { operationId?: string }>> } =
  yaml.load(readFileSync(new URL("../api/openapi.yaml", import.meta.url), "utf8"));
const specialized = new Set([
  "createGuest", "requestEmailCode", "verifyEmailCode", "signInWithPassword", "refreshTokens",
  "logout", "deleteMe", "listProducts", "createStripeCheckout",
]);
const base = "https://web.sona.invalid";

test("each viewer operation has a web handler", async t => {
  const relay = t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true }));
  const checked = new Set<string>();
  for (const [path, methods] of Object.entries(spec.paths)) {
    if (!path.startsWith("/v1/")) continue;
    for (const [verb, { operationId }] of Object.entries(methods)) {
      if (!operationId) continue;
      checked.add(operationId);
      if (specialized.has(operationId)) continue;
      const method = verb.toUpperCase() as keyof typeof content;
      const actualPath = path.slice(4).replace(/\{[^}]+\}/g, "39");
      const body = method === "POST" || method === "PUT" || method === "PATCH" ? {} : undefined;
      const request = new NextRequest(base + "/api/content/" + actualPath, {
        method, headers: { Origin: base, Cookie: "sona_access=fixture", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await content[method](request, { params: Promise.resolve({ path: actualPath.split("/") }) });
      assert.equal(res.status, 200, method + " " + path);
      const call = relay.mock.calls.at(-1) as unknown as { arguments: [URL, RequestInit] };
      assert.equal(call.arguments[0].pathname, "/v1/" + actualPath);
      assert.equal(call.arguments[1].method, method);
    }
  }
  for (const operation of specialized) assert.ok(checked.has(operation), operation);
  assert.equal(checked.size, 39);
  assert.equal(relay.mock.callCount(), 30);
});
