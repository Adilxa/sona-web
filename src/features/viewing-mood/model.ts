import type { CatalogTerm } from "@/entities/series";

export const moods = {
  joy: {
    label: "Весёлое", art: "water", headline: "с улыбкой", shelf: "Для хорошего настроения",
    terms: ["комедия", "юмор", "ромком", "романтическая комедия", "сатира", "comedy", "humor", "humour", "romcom", "romantic comedy"],
  },
  thrill: {
    label: "Захватывающее", art: "desert", headline: "до мурашек", shelf: "Держат в напряжении",
    terms: ["приключения", "фэнтези", "фантастика", "триллер", "детектив", "боевик", "мистика", "adventure", "fantasy", "science fiction", "sci fi", "thriller", "mystery", "action"],
  },
  wistful: {
    label: "Грустное", art: "signal", headline: "до слёз", shelf: "Трогают до слёз",
    terms: ["драма", "мелодрама", "трагедия", "трагическая любовь", "drama", "melodrama", "tragedy", "tragic love"],
  },
} as const;

export type ViewingMood = keyof typeof moods;
export const moodOptions = Object.keys(moods) as ViewingMood[];
export const defaultMood: ViewingMood = "thrill";

export function isViewingMood(value: unknown): value is ViewingMood {
  return typeof value === "string" && Object.hasOwn(moods, value);
}

function normalizeTerm(value: string) {
  return value.toLowerCase().replaceAll("ё", "е").replace(/[-_]+/g, " ").trim();
}

export function matchingMoodTerm(mood: ViewingMood, card: { genres: CatalogTerm[]; tags: CatalogTerm[] }) {
  const accepted: readonly string[] = moods[mood].terms;
  return [...card.genres, ...card.tags].find(term => [term.slug, term.name].some(value => accepted.includes(normalizeTerm(value))));
}
