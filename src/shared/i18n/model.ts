export type Locale = "ru" | "en";
export const localeCookie = "sona_ui_lang";
export const isLocale = (value: unknown): value is Locale => value === "ru" || value === "en";

export function resolveLocale(saved?: string, acceptLanguage?: string | null): Locale {
  if (isLocale(saved)) return saved;
  const preferences = (acceptLanguage ?? "").split(",").map(entry => {
    const [tag, quality] = entry.trim().toLowerCase().split(/\s*;\s*q\s*=\s*/);
    return { language: tag.split("-")[0], weight: quality === undefined ? 1 : Number(quality) };
  }).filter(entry => isLocale(entry.language) && entry.weight > 0 && entry.weight <= 1);
  preferences.sort((a, b) => b.weight - a.weight);
  return preferences[0]?.language === "en" ? "en" : "ru";
}

export function documentLocale(): Locale {
  return typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ru";
}

export function uiText(russian: string, english: string) {
  return documentLocale() === "en" ? english : russian;
}
