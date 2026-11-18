type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  accessToken?: string;
  language?: string;
  query?: URLSearchParams;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

/** Server-side transport. Callers decode successful responses using the generated schema. */
export async function requestSona(path: `/v1/${string}`, options: RequestOptions = {}) {
  if (typeof window !== "undefined") throw new Error("Server transport required");
  const origin = new URL(process.env.SONA_API_ORIGIN ?? "https://sona.indicart.org");
  const url = new URL(path, origin);
  if (origin.protocol !== "https:" || origin.username || origin.password ||
      url.origin !== origin.origin || !url.pathname.startsWith("/v1/")) {
    throw new Error("Invalid Sona API URL");
  }
  if (options.query) url.search = options.query.toString();
  const headers = new Headers({ Accept: "application/json, application/problem+json" });
  headers.set("Accept-Language", options.language || "ru");
  if (options.accessToken) headers.set("Authorization", `Bearer ${options.accessToken}`);
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: JSON.stringify(options.body),
    signal: options.signal,
    cache: "no-store",
    redirect: "error",
  });
  console.info("Sona API", { status: response.status, requestId: response.headers.get("X-Request-Id") });
  return response;
}
