import { Layers2 } from "lucide-react";
import styles from "./episode-count.module.css";

const plural = new Intl.PluralRules("ru");

export function EpisodeCount({ total, current }: { total?: number; current?: number }) {
  const hasTotal = typeof total === "number" && Number.isSafeInteger(total) && total >= 0;
  const hasCurrent = typeof current === "number" && Number.isSafeInteger(current) && current > 0;
  if (!hasTotal && !hasCurrent) return null;
  let label: string;
  if (hasCurrent) {
    label = hasTotal && total >= current ? `Серия ${current} из ${total}` : `Серия ${current}`;
  } else {
    const form = plural.select(total as number);
    label = `${total} ${form === "one" ? "серия" : form === "few" ? "серии" : "серий"}`;
  }
  return <span className={styles.count}><Layers2 size={13} strokeWidth={1.8} aria-hidden="true" />{label}</span>;
}
