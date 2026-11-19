import type { Locale } from "../i18n/model";

const publicSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function seriesPath(id: number | string, slug?: string) {
  const segment = String(id);
  const suffix = slug && slug.length <= 120 && publicSlug.test(slug) ? "-" + slug : "";
  return "/series/" + encodeURIComponent(segment) + suffix;
}

export function parseSeriesSegment(segment: string): number | null {
  const match = /^([1-9]\d{0,9})(?:-([a-z0-9]+(?:-[a-z0-9]+)*))?$/.exec(segment);
  if (!match || (match[2]?.length ?? 0) > 120) return null;
  const number = Number(match[1]);
  return number <= 2_147_483_647 ? number : null;
}

export function localizedPath(path: string, locale: Locale) {
  const [pathname, query] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("lang", locale);
  return pathname + "?" + params;
}

export function loginDestination(value?: string | string[]) {
  if (typeof value !== "string") return "/profile";
  if (["/settings", "/shop", "/wallet", "/rewards", "/devices", "/history", "/favorites"].includes(value)) return value;

  const match = /^\/series\/([^/?#]+)(?:\?([^#]*))?$/.exec(value);
  if (!match || parseSeriesSegment(match[1]) === null) return "/profile";

  const query = new URLSearchParams(match[2]);
  const result = new URLSearchParams();
  for (const [name, part] of query) {
    if (name === "episode" && /^[1-9]\d*$/.test(part)) result.set(name, part);
    if (name === "at" && /^(0|[1-9]\d*)$/.test(part)) result.set(name, part);
    if (name === "lang" && (part === "ru" || part === "en")) result.set(name, part);
    if (name === "play" && part === "1") result.set(name, part);
  }
  return "/series/" + match[1] + (result.size ? "?" + result : "");
}
