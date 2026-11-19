"use client";

import { useI18n } from "@/shared/i18n/context";
import styles from "./episode-count.module.css";

const plurals = { ru: new Intl.PluralRules("ru"), en: new Intl.PluralRules("en") };

export function EpisodeCount({ total, current }: { total?: number; current?: number }) {
  const { locale, t } = useI18n();
  const hasTotal = typeof total === "number" && Number.isSafeInteger(total) && total >= 0;
  const hasCurrent = typeof current === "number" && Number.isSafeInteger(current) && current > 0;
  if (!hasTotal && !hasCurrent) return null;
  let label: string;
  if (hasCurrent) {
    label = hasTotal && total >= current
      ? t(`Серия ${current} из ${total}`, `Episode ${current} of ${total}`)
      : t(`Серия ${current}`, `Episode ${current}`);
  } else {
    const form = plurals[locale].select(total!);
    const unit = t(form === "one" ? "серия" : form === "few" ? "серии" : "серий", form === "one" ? "episode" : "episodes");
    label = `${total} ${unit}`;
  }
  return <span className={styles.count}>{label}</span>;
}
