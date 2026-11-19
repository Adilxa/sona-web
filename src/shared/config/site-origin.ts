export function configuredSiteOrigin(): string | undefined {
  const configured = process.env.SONA_SITE_ORIGIN ||
    (process.env.NODE_ENV === "production" ? "https://sona-ai.watch" : undefined);
  if (!configured) return undefined;
  const url = new URL(configured);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("SONA_SITE_ORIGIN must be the public web origin.");
  }
  return url.origin;
}

export function siteOrigin() {
  return configuredSiteOrigin() ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined);
}
