import { requestSona } from "@/shared/api/sona.server";

export async function GET(request: Request) {
  let upstream: Response;
  try {
    upstream = await requestSona("/v1/products", {
      language: request.headers.get("Accept-Language") ?? "ru",
      query: new URLSearchParams({ platform: "web" }),
      signal: request.signal,
    });
  } catch {
    return Response.json({ type: "about:blank", title: "Bad Gateway", status: 502, code: "upstream_unavailable" }, {
      status: 502,
      headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store" },
    });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of ["Content-Type", "X-Request-Id", "Retry-After"]) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
