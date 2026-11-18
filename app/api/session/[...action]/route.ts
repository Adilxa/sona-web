import { NextRequest, NextResponse } from "next/server";
import { requestSona } from "@/shared/api/sona.server";
import { relay, sameOrigin, sessionCookies, upstreamHeaders } from "@/shared/api/session.server";
import type { components } from "@/shared/api/schema";

type Schema = components["schemas"];
const actions = new Set(["email/request", "email/verify", "email/login", "email/link", "logout", "delete-account"]);

function credentials(action: string, input: Record<string, unknown>) {
  const { email, password, code, attestation } = input;
  if (typeof email !== "string" || email.length < 3 || email.length > 254 || typeof password !== "string") return;
  const length = Array.from(password).length;
  if (length < (action === "email/login" ? 1 : 15) || length > 128) return;
  if (action === "email/request") {
    if (attestation === undefined) return { email, password };
    if (!attestation || typeof attestation !== "object" || !("kind" in attestation) || attestation.kind !== "turnstile" || !("token" in attestation) || typeof attestation.token !== "string") return;
    return { email, password, attestation: { kind: "turnstile", token: attestation.token } } satisfies Schema["EmailCodeRequest"];
  }
  const device = input.device;
  if (!device || typeof device !== "object" || !("device_id" in device) || typeof device.device_id !== "string" || !("platform" in device) || device.platform !== "web" || !("timezone" in device) || typeof device.timezone !== "string") return;
  const payload = { email, password, device: { device_id: device.device_id, platform: "web", timezone: device.timezone } } satisfies Schema["PasswordLogin"];
  if (action === "email/login") return payload;
  if (typeof code === "string" && /^[0-9]{6}$/.test(code)) return { ...payload, code } satisfies Schema["EmailCodeVerify"];
}

export async function POST(request: NextRequest, context: RouteContext<"/api/session/[...action]">) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const action = (await context.params).action.join("/");
  if (!actions.has(action)) return new Response(null, { status: 404 });
  const token = request.cookies.get("sona_access")?.value;
  const closing = action === "logout" || action === "delete-account";
  let body: Record<string, unknown> | undefined;
  if (!closing) {
    const input = await request.json().catch(() => null);
    if (input && typeof input === "object" && !Array.isArray(input)) body = credentials(action, input);
    if (!body) return new Response(null, { status: 400 });
  }
  try {
    if (body && action !== "email/request") {
      if (!token) return new Response(null, { status: 401 });
      const account = await requestSona("/v1/me", { accessToken: token });
      if (!account.ok) return relay(account);
      const me: Schema["Me"] = await account.json();
      if (action === "email/link") {
        if (me.role !== "user") return Response.json({ code: "registration_required" }, { status: 403 });
        body.legacy_access_token = token;
      } else {
        if (me.role !== "guest") return Response.json({ code: "already_signed_in" }, { status: 409 });
        body.guest_access_token = token;
      }
    }
    const upstream = await requestSona(action === "delete-account" ? "/v1/me" : `/v1/auth/${action === "email/link" ? "email/verify" : action}`, {
      method: action === "delete-account" ? "DELETE" : "POST", body, accessToken: closing ? token : undefined,
      language: request.headers.get("Accept-Language") ?? "ru",
    });
    if (!upstream.ok) return relay(upstream);
    const headers = upstreamHeaders(upstream);
    if (action === "delete-account") return sessionCookies(request, NextResponse.json(await upstream.json(), { status: upstream.status, headers }), null);
    if (action === "logout") return sessionCookies(request, new NextResponse(null, { status: 204, headers }), null);
    if (action === "email/request") return new Response(null, { status: upstream.status, headers });
    const pair: Schema["TokenPair"] = await upstream.json();
    return sessionCookies(request, NextResponse.json({ deletion_cancelled: !!pair.deletion_cancelled }, { headers }), pair);
  } catch {
    return new Response(null, { status: 502 });
  }
}
