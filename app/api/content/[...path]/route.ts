import { NextRequest } from "next/server";
import { requestSona } from "@/shared/api/sona.server";
import { relay, sameOrigin } from "@/shared/api/session.server";

const routes = {
  GET: /^(catalog|feed|home|search|series\/[\w-]+(?:\/episodes)?|episodes\/[\w-]+\/playback|me|me\/(favorites|continue-watching|wallet(?:\/ledger)?|checkin|streak|daily-free|devices|notification-settings))$/,
  PUT: /^(series\/[\w-]+\/(favorite|like)|me\/push-token)$/,
  DELETE: /^(series\/[\w-]+\/(favorite|like)|me\/devices\/[\w-]+|me\/push-token)$/,
  POST: /^(me\/checkin|progress|events|episodes\/[\w-]+\/unlock)$/,
  PATCH: /^me(?:\/notification-settings)?$/,
};

async function handle(request: NextRequest, context: RouteContext<"/api/content/[...path]">) {
  const path = (await context.params).path.join("/");
  const method = request.method as keyof typeof routes;
  if (method !== "GET" && !sameOrigin(request)) return new Response(null, { status: 403 });
  if (!routes[method].test(path)) return new Response(null, { status: 404 });
  const token = request.cookies.get("sona_access")?.value;
  if (!token) return new Response(null, { status: 401 });
  let body: unknown;
  if ((method === "POST" && path !== "me/checkin") || method === "PATCH" || (method === "PUT" && path === "me/push-token")) {
    try {
      body = await request.json();
    } catch {
      return new Response(null, { status: 400 });
    }
  }
  try {
    return relay(
      await requestSona(`/v1/${path}`, {
        method,
        body,
        accessToken: token,
        query: request.nextUrl.searchParams,
        idempotencyKey: request.headers.get("Idempotency-Key") ?? undefined,
        language: request.headers.get("accept-language") ?? "ru",
        signal: request.signal,
      }),
    );
  } catch {
    return new Response(null, { status: 502 });
  }
}

export { handle as GET, handle as PUT, handle as DELETE, handle as POST, handle as PATCH };
