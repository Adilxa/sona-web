import { NextRequest, NextResponse } from "next/server";
import { requestSona } from "@/shared/api/sona.server";
import { sameOrigin, relay, sessionCookies } from "@/shared/api/session.server";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const input = await request.json().catch(() => null);
  if (
    !input ||
    typeof input.deviceId !== "string" ||
    !/^[\w-]{16,128}$/.test(input.deviceId) ||
    typeof input.timezone !== "string" ||
    !input.timezone ||
    input.timezone.length > 64
  ) {
    return new Response(null, { status: 400 });
  }
  if (!input.force && request.cookies.has("sona_access")) return new Response(null, { status: 204 });
  const refresh = request.cookies.get("sona_refresh")?.value;
  const guest = () =>
    requestSona("/v1/auth/guest", {
      method: "POST",
      body: { device_id: input.deviceId, platform: "web", timezone: input.timezone },
    });
  try {
    let source = refresh
      ? await requestSona("/v1/auth/refresh", {
          method: "POST",
          body: { refresh_token: refresh },
        })
      : await guest();
    if (refresh && source.status === 401) source = await guest();
    if (!source.ok) return relay(source);
    return sessionCookies(request, new NextResponse(null, { status: 204 }), await source.json());
  } catch {
    return new Response(null, { status: 502 });
  }
}
