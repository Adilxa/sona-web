"use client";

import { useI18n } from "@/shared/i18n/context";
import styles from "./sona-loader.module.css";

export function SonaLoader({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <span className={styles.loader} role="status">
      <span className={styles.wave} aria-hidden="true"><i /><i /><i /><i /><i /></span>
      <span>{label ?? t("Загружаем…", "Loading…")}</span>
    </span>
  );
}

export function RouteLoader() {
  const { t } = useI18n();
  return <div className={styles.page}><SonaLoader label={t("Загружаем страницу…", "Loading page…")} /></div>;
}
