import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST as authenticate } from "../app/api/session/[...action]/route";
import { POST as session } from "../app/api/session/route";
import { POST as mutate, GET as read } from "../app/api/content/[...path]/route";

const password = "correct horse fixture";
const origin = "https://test.sona.invalid";
const device = { device_id: "sona-test-installation", platform: "web", timezone: "UTC" };
const fakePair = {
  access_token: "registered-access-fixture",
  refresh_token: "registered-refresh-fixture",
  access_expires_at: "2030-01-01T00:00:00Z",
  refresh_expires_at: "2031-01-01T00:00:00Z",
  user_id: "test-user",
  role: "user",
  deletion_cancelled: true,
};
function request(path: string, body?: unknown, cookie = "", extra?: Record<string, string>) {
  return new NextRequest(origin + path, {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json", ...extra },
    body: JSON.stringify(body),
  });
}
const ctx = (action: string) => ({ params: Promise.resolve({ action: action.split("/") }) });

test("verification preserves the guest, leading zeroes and HttpOnly cookie scopes", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
    if (url.pathname === "/v1/me") {
      assert.equal(new Headers(options.headers).get("Authorization"), "Bearer guest-access");
      return Response.json({ role: "guest" });
    }
    assert.equal(url.pathname, "/v1/auth/email/verify");
    assert.deepEqual(JSON.parse(String(options.body)), {
      email: "qa@example.invalid", password,
      code: "000123",
      device,
      guest_access_token: "guest-access",
    });
    return Response.json(fakePair);
  });
  const res = await authenticate(
    request(
      "/api/session/email/verify",
      { email: "qa@example.invalid", password, code: "000123", device, guest_access_token: "ignored", legacy_access_token: "ignored" },
      "sona_access=guest-access",
    ),
    ctx("email/verify"),
  );
  assert.equal(res.status, 200);
  assert.equal(upstream.mock.callCount(), 2);
  assert.deepEqual(await res.json(), { deletion_cancelled: true });
  const cookies = res.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /Path=\/api;/);
  assert.match(cookies[1], /Path=\/api\/session;/);
  for (const cookie of cookies) {
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
  }
});

test("email registration forwards password, optional Turnstile and retry instructions", async (t) => {
  const body = { email: "qa@example.invalid", password, attestation: { kind: "turnstile", token: "test-challenge" } };
  t.mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
    assert.equal(url.pathname, "/v1/auth/email/request");
    assert.deepEqual(JSON.parse(String(options.body)), body);
    return Response.json({ code: "rate_limited" }, { status: 429, headers: { "Retry-After": "45", "X-Request-Id": "qa-id" } });
  });
  const res = await authenticate(request("/api/session/email/request", body), ctx("email/request"));
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "45");
  assert.equal(res.headers.get("X-Request-Id"), "qa-id");
  assert.equal(res.headers.get("Set-Cookie"), null);
});

test("an incorrect code leaves the guest session in place", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: URL) =>
    url.pathname === "/v1/me"
      ? Response.json({ role: "guest" })
      : Response.json({ code: "invalid_credentials" }, { status: 401 }),
  );
  const res = await authenticate(
    request(
      "/api/session/email/verify",
      { email: "qa@example.invalid", password, code: "000123", device },
      "sona_access=guest-access",
    ),
    ctx("email/verify"),
  );
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("Set-Cookie"), null);
  assert.deepEqual(await res.json(), { code: "invalid_credentials" });
});

test("logout revokes the upstream session and expires both cookies", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
    assert.equal(url.pathname, "/v1/auth/logout");
    assert.equal(new Headers(options.headers).get("authorization"), "Bearer logged-in");
    return new Response(null, { status: 204 });
  });
  const res = await authenticate(
    request("/api/session/logout", undefined, "sona_access=logged-in"),
    ctx("logout"),
  );
  assert.equal(res.status, 204);
  assert.equal(res.headers.getSetCookie().length, 2);
  for (const cookie of res.headers.getSetCookie()) assert.match(cookie, /1970/);
});

test("the session uses the latest refresh cookie, cross-site login is rejected", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", async (url: URL, opts: RequestInit) => {
    assert.equal(url.pathname, "/v1/auth/refresh");
    assert.deepEqual(JSON.parse(String(opts.body)), { refresh_token: "first-refresh" });
    return Response.json(fakePair);
  });
  const res = await session(
    request(
      "/api/session",
      { deviceId: device.device_id, timezone: "UTC", force: true },
      "sona_refresh=first-refresh",
    ),
  );
  assert.equal(res.status, 204);
  assert.equal(res.headers.getSetCookie().length, 2);
  const blocked = await authenticate(
    request("/api/session/email/login", {}, "", {
      Origin: "https://other.invalid",
      "Sec-Fetch-Site": "cross-site",
    }),
    ctx("email/login"),
  );
  assert.equal(blocked.status, 403);
  assert.equal(upstream.mock.callCount(), 1);
});

test("daily check-in forwards the same idempotency key and account reads require a session", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: URL, opts: RequestInit) => {
    assert.equal(url.pathname, "/v1/me/checkin");
    assert.equal(new Headers(opts.headers).get("Idempotency-Key"), "test-intent");
    assert.equal(opts.body, undefined);
    return Response.json({ reward_coins: 12 });
  });
  const checkin = await mutate(
    request("/api/content/me/checkin", undefined, "sona_access=test", { "Idempotency-Key": "test-intent" }),
    { params: Promise.resolve({ path: ["me", "checkin"] }) },
  );
  assert.equal(checkin.status, 200);
  const guest = await read(new NextRequest(origin + "/api/content/me/wallet"), {
    params: Promise.resolve({ path: ["me", "wallet"] }),
  });
  assert.equal(guest.status, 401);
});

test("password login merges the current guest through its HttpOnly cookie", async t => {
  t.mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
    if (url.pathname === "/v1/me") return Response.json({ role: "guest" });
    assert.equal(url.pathname, "/v1/auth/email/login");
    assert.deepEqual(JSON.parse(String(options.body)), { email: "qa@example.invalid", password: "short", device, guest_access_token: "browser-guest" });
    return Response.json(fakePair);
  });
  const res = await authenticate(request("/api/session/email/login", { email: "qa@example.invalid", password: "short", device, legacy_access_token: "ignored" }, "sona_access=browser-guest"), ctx("email/login"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { deletion_cancelled: true });
  assert.equal(res.headers.getSetCookie().length, 2);
});

test("explicit legacy linking verifies the email using only the existing registered access token", async t => {
  t.mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
    if (url.pathname === "/v1/me") return Response.json({ role: "user" });
    assert.equal(url.pathname, "/v1/auth/email/verify");
    assert.deepEqual(JSON.parse(String(options.body)), { email: "qa@example.invalid", password, code: "030303", device, legacy_access_token: "legacy-current" });
    return Response.json(fakePair);
  });
  const body = { email: "qa@example.invalid", password, code: "030303", device, guest_access_token: "ignored", legacy_access_token: "ignored" };
  const ordinary = await authenticate(request("/api/session/email/verify", body, "sona_access=legacy-current"), ctx("email/verify"));
  assert.equal(ordinary.status, 409);
  const linked = await authenticate(request("/api/session/email/link", body, "sona_access=legacy-current"), ctx("email/link"));
  assert.equal(linked.status, 200);
  assert.deepEqual(await linked.json(), { deletion_cancelled: true });
});

test("legacy linking refuses an expired session that became a guest; removed methods and malformed new passwords never reach auth", async t => {
  const upstream = t.mock.method(globalThis, "fetch", async (url: URL) => {
    assert.equal(url.pathname, "/v1/me"); return Response.json({ role: "guest" });
  });
  const body = { email: "qa@example.invalid", password, code: "030303", device };
  assert.equal((await authenticate(request("/api/session/email/link", body, "sona_access=guest"), ctx("email/link"))).status, 403);
  for (const action of ["otp/request", "otp/verify", "pin/login", "apple", "google"]) {
    assert.equal((await authenticate(request("/api/session/" + action, {}), ctx(action))).status, 404);
  }
  for (const invalid of ["short", "x".repeat(129)]) {
    assert.equal((await authenticate(request("/api/session/email/request", { email: body.email, password: invalid }), ctx("email/request"))).status, 400);
  }
  assert.equal(upstream.mock.callCount(), 1);
});
