import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { bindDevicePush } from "../src/features/notifications/device-push";

test("a prepared FCM token binds only to its active user under the session lock", async t => {
  const requests: { url: string; method: string; body?: string }[] = [];
  let viewer = "user-a";
  let role = "user";
  let allowed = true;
  let locked = false;
  const previous = Object.getOwnPropertyDescriptor(navigator, "locks");
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: async (name: string, action: () => Promise<boolean>) => {
      assert.equal(name, "sona-session");
      locked = true;
      try { return await action(); } finally { locked = false; }
    },
  } });
  t.after(() => {
    if (previous) Object.defineProperty(navigator, "locks", previous);
    else Reflect.deleteProperty(navigator, "locks");
  });
  t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    assert.equal(locked, true);
    requests.push({ url: input, method: init?.method ?? "GET", body: init?.body?.toString() });
    if (input === "/api/content/me") return Response.json({ id: viewer, role });
    return new Response(null, { status: 204 });
  });
  const body = { token: "fixture-token-for-a-device-not-registered-with-fcm", provider: "fcm" as const, locale: "ru" };
  assert.equal(await bindDevicePush("user-a", body, () => allowed), true);
  assert.deepEqual(requests.map(request => request.method), ["GET", "PUT"]);
  assert.deepEqual(JSON.parse(requests.at(-1)!.body!), body);
  viewer = "user-b";
  assert.equal(await bindDevicePush("user-a", body, () => allowed), false);
  role = "guest";
  assert.equal(await bindDevicePush("user-b", body, () => allowed), false);
  allowed = false;
  assert.equal(await bindDevicePush("user-b", body, () => allowed), false);
  assert.equal(requests.length, 4);
  allowed = true; role = "user";
  assert.equal(await bindDevicePush("user-b", undefined, () => allowed), true);
  assert.equal(requests.at(-1)!.method, "DELETE");
  assert.equal(requests.at(-1)!.body, undefined);
});

test("the messaging worker renders one notification and opens only the Sona origin", async () => {
  const handlers = new Map<string, (event: object) => void>();
  const displayed: { title: string; options: { body: string; data: { link: string } } }[] = [];
  const opened: string[] = [];
  const origin = "https://sona.example";
  const worker = {
    location: { origin },
    registration: { showNotification: async (title: string, options: typeof displayed[number]["options"]) => { displayed.push({ title, options }); } },
    clients: { matchAll: async () => [], openWindow: async (href: string) => { opened.push(href); } },
    addEventListener: (name: string, handler: (event: object) => void) => handlers.set(name, handler),
  };
  runInNewContext(await readFile(new URL("../public/sona-messaging-sw.js", import.meta.url), "utf8"), { self: worker, URL });
  async function emit(name: string, event: object) {
    let work: Promise<unknown> | undefined;
    handlers.get(name)!({ ...event, waitUntil: (task: Promise<unknown>) => { work = task; } });
    await work;
  }
  await emit("push", { data: { json: () => ({ notification: { title: "Новая серия", body: "Уже доступна" }, data: { link: "/series/8?episode=20" } }) } });
  assert.equal(displayed.length, 1);
  assert.equal(displayed[0].options.data.link, origin + "/series/8?episode=20");
  await emit("notificationclick", { notification: { close() {}, data: displayed[0].options.data } });
  await emit("notificationclick", { notification: { close() {}, data: { link: "https://outside.example/redirect" } } });
  assert.deepEqual(opened, [origin + "/series/8?episode=20", origin + "/"]);
});

test("unreachable push cleanup does not block logout or account deletion", async t => {
  const { authenticate } = await import("../src/entities/session");
  const previous = Object.getOwnPropertyDescriptor(navigator, "locks");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let inSession = false;
  const calls: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: async (name: string, action: () => Promise<unknown>) => {
      assert.equal(name, "sona-session");
      assert.equal(inSession, false);
      inSession = true;
      try { return await action(); } finally { inSession = false; }
    },
  } });
  t.after(() => {
    if (previous) Object.defineProperty(navigator, "locks", previous);
    else Reflect.deleteProperty(navigator, "locks");
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  t.mock.method(globalThis, "fetch", async (path: string, init?: RequestInit) => {
    assert.equal(inSession, true);
    calls.push(`${init?.method ?? "GET"} ${path}`);
    if (path === "/api/content/me/push-token") {
      assert.ok(init?.signal);
      throw Error("offline");
    }
    if (path === "/api/session/logout") return new Response(null, { status: 204 });
    return Response.json({});
  });
  for (const action of ["logout", "delete-account"] as const) {
    await authenticate(action);
    assert.deepEqual(calls.splice(0), ["GET /api/content/me", "DELETE /api/content/me/push-token", `POST /api/session/${action}`]);
  }
});
