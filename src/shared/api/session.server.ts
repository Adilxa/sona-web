import { NextRequest, NextResponse } from "next/server";
import type { components } from "./schema";

export function sameOrigin(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin") return true;
  return request.headers.get("origin") === request.nextUrl.origin && site !== "cross-site";
}

export function upstreamHeaders(source: Response) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  for (const key of ["Content-Type", "X-Request-Id", "Retry-After"]) {
    const value = source.headers.get(key);
    if (value) headers.set(key, value);
  }
  return headers;
}

export function relay(source: Response) {
  return new Response(source.body, { status: source.status, headers: upstreamHeaders(source) });
}

export function sessionCookies(
  request: NextRequest,
  response: NextResponse,
  pair: components["schemas"]["TokenPair"] | null,
) {
  for (const [name, path, token, expiry] of [
    ["sona_access", "/api", pair?.access_token, pair?.access_expires_at],
    ["sona_refresh", "/api/session", pair?.refresh_token, pair?.refresh_expires_at],
  ] as const) {
    if (
      pair &&
      (typeof token !== "string" ||
        !token ||
        typeof expiry !== "string" ||
        !Number.isFinite(Date.parse(expiry)))
    )
      throw Error("Invalid token pair");
    response.cookies.set(name, token ?? "", {
      expires: new Date(expiry ?? 0),
      path,
      httpOnly: true,
      sameSite: "strict",
      secure: request.nextUrl.protocol === "https:",
    });
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
