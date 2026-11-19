import { cache } from "react";
import { cookies, headers } from "next/headers";
import { isLocale, localeCookie, resolveLocale } from "./model";

export const getServerLocale = cache(async () => {
  const [jar, request] = await Promise.all([cookies(), headers()]);
  const explicit = request.get("x-sona-page-language");
  if (isLocale(explicit)) return explicit;
  return resolveLocale(jar.get(localeCookie)?.value, request.get("accept-language"));
});

export function pageMetadata(russian: string, english: string) {
  return async () => ({ title: (await getServerLocale()) === "en" ? english : russian, robots: { index: false, follow: false } });
}
