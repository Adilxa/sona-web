"use client";

import { isLocale } from "./model";
import { useI18n } from "./context";
import styles from "./language-select.module.css";

export function LanguageSelect() {
  const { locale, t, setLocale } = useI18n();
  return <label className={styles.language}>
    {t("Язык интерфейса", "Interface language")}
    <select value={locale} onChange={({currentTarget}) => { if (isLocale(currentTarget.value)) setLocale(currentTarget.value); }}>
      <option value="ru" lang="ru">Русский</option>
      <option value="en" lang="en">English</option>
    </select>
  </label>;
}
