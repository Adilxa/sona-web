import type { components } from "@/shared/api/schema";

type Me = components["schemas"]["Me"];
export const localePattern = "[a-z]{2,3}(-[A-Za-z0-9]{2,8})*";
export const zonePattern = "[A-Za-z0-9._+\\-]+(/[A-Za-z0-9._+\\-]+)*";
const validLocale = new RegExp("^" + localePattern + "$");
const commonLocales = "ru ky kk uz en uk az hy be ar bg bn cs de el es fa fi fr he hi hu id it ja ka ko mn ms nl pl pt pt-BR ro sr sv ta tg th tr ur vi zh-Hans zh-Hant".split(" ");


export function languageChoices(current: string | null | undefined, browser: readonly string[] = [], uiLocale = "ru") {
  const collator = new Intl.Collator(uiLocale);
  const names = new Intl.DisplayNames(uiLocale, { type: "language", fallback: "none" });
  const ids = new Set([...commonLocales, ...browser.filter(code => code.length <= 35 && validLocale.test(code))]);
  if (current) ids.add(current);
  return [...ids].map(value => {
    let label: string | undefined;
    try { label = names.of(value); } catch { /* Keep the account's stored value selectable. */ }
    return { value, label: label ? label[0].toLocaleUpperCase(uiLocale) + label.slice(1) : value };
  }).sort((a, b) => collator.compare(a.label, b.label));
}

const cities: Record<string, string> = {
  UTC: "UTC · Всемирное время", "Asia/Bishkek": "Бишкек", "Asia/Almaty": "Алматы", "Asia/Qostanay": "Костанай",
  "Asia/Aqtobe": "Актобе", "Asia/Aqtau": "Актау", "Asia/Atyrau": "Атырау", "Asia/Oral": "Уральск",
  "Asia/Tashkent": "Ташкент", "Asia/Samarkand": "Самарканд", "Asia/Dushanbe": "Душанбе", "Asia/Ashgabat": "Ашхабад",
  "Asia/Tbilisi": "Тбилиси", "Asia/Yerevan": "Ереван", "Asia/Baku": "Баку", "Asia/Dubai": "Дубай",
  "Europe/Moscow": "Москва", "Europe/Kaliningrad": "Калининград", "Europe/Samara": "Самара",
  "Asia/Yekaterinburg": "Екатеринбург", "Asia/Omsk": "Омск", "Asia/Novosibirsk": "Новосибирск",
  "Asia/Krasnoyarsk": "Красноярск", "Asia/Irkutsk": "Иркутск", "Asia/Yakutsk": "Якутск", "Asia/Vladivostok": "Владивосток",
  "Asia/Magadan": "Магадан", "Asia/Kamchatka": "Камчатка", "Europe/Minsk": "Минск", "Europe/Kyiv": "Киев", "Europe/Kiev": "Киев",
  "Europe/Istanbul": "Стамбул", "Europe/London": "Лондон", "Europe/Berlin": "Берлин", "Europe/Paris": "Париж",
  "Asia/Tokyo": "Токио", "Asia/Seoul": "Сеул", "Asia/Shanghai": "Шанхай", "America/New_York": "Нью-Йорк", "America/Los_Angeles": "Лос-Анджелес",
};
const regions: Record<string, string> = {
  Africa: "Африка", America: "Америка", Antarctica: "Антарктида", Arctic: "Арктика", Asia: "Азия",
  Atlantic: "Атлантический океан", Australia: "Австралия", Europe: "Европа", Indian: "Индийский океан", Pacific: "Тихий океан",
};

export function zoneChoices(current: string, uiLocale = "ru") {
  const collator = new Intl.Collator(uiLocale);
  const known = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : Object.keys(cities);
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const value of new Set(["UTC", ...known, current].filter(Boolean))) {
    const [region, ...parts] = value.split("/");
    const group = uiLocale === "ru" ? regions[region] ?? "Общие" : region in regions ? region : "General";
    const list = groups.get(group) ?? [];
    const city = parts.length ? parts.reverse().join(", ").replaceAll("_", " ") : value;
    const label = uiLocale === "ru" ? cities[value] ?? city : value === "UTC" ? "UTC · Coordinated Universal Time" : city;
    list.push({ value, label });
    groups.set(group, list);
  }
  return [...groups].map(([label, options]) => ({ label, options: options.sort((a, b) => collator.compare(a.label, b.label)) }))
    .sort((a, b) => collator.compare(a.label, b.label));
}

export function preferenceChanges(me: Pick<Me, "locale" | "timezone">, locale: string, timezone: string, locked: boolean) {
  const changes: components["schemas"]["MeUpdate"] = {};
  const language = locale.trim();
  const zone = timezone.trim();
  if (language !== (me.locale ?? "")) changes.locale = language;
  if (!locked && zone !== me.timezone) changes.timezone = zone;
  return changes;
}

export function zoneDate(date: string | null | undefined, timeZone: string, offsetOnly = false, uiLocale = "ru") {
  if (!date || !Number.isFinite(Date.parse(date))) return "";
  const at = new Date(date);
  try {
    const format = new Intl.DateTimeFormat(uiLocale, { timeZone, timeZoneName: "shortOffset",
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return offsetOnly ? format.formatToParts(at).find(part => part.type === "timeZoneName")?.value.replace("GMT", "UTC") ?? "" : format.format(at);
  } catch {
    return offsetOnly ? "" : at.toLocaleString(uiLocale);
  }
}
