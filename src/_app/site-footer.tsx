"use client";

import { useI18n } from "@/shared/i18n/context";
import { localizedPath } from "@/shared/seo/urls";
import { LanguageSelect } from "@/shared/i18n/language-select";
import Link from "next/link";
import { BrandMark } from "@/shared/ui/brand-mark";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  const { t, locale } = useI18n();
  return <footer className={styles.footer}>
    <div className={styles.inner}>
      <div className={styles.identity}><Link href={localizedPath("/", locale)} aria-label={t("SONA, главная", "SONA, home")} className={styles.wordmark}><BrandMark /></Link><LanguageSelect /></div>
      <nav aria-label={t("Разделы в подвале", "Footer navigation")}>
        <div><strong>{t("Смотреть", "Watch")}</strong><Link href={localizedPath("/feed", locale)}>{t("Лента", "Feed")}</Link><Link href={localizedPath("/catalog", locale)}>{t("Каталог сериалов", "Series catalog")}</Link><a href="#page-top">{t("Наверх ↑", "Back to top ↑")}</a></div>
        <div><strong>{t("Моя коллекция", "My collection")}</strong><Link href="/history">{t("История просмотра", "Watch history")}</Link><Link href="/favorites">{t("Избранное", "Favorites")}</Link><Link href="/profile">{t("Профиль", "Profile")}</Link></div>
        <div><strong>{t("О сервисе", "About SONA")}</strong><Link href={localizedPath("/help", locale)}>{t("Помощь", "Help")}</Link><Link href={localizedPath("/privacy", locale)}>{t("Конфиденциальность", "Privacy")}</Link><Link href={localizedPath("/terms", locale)}>{t("Условия использования", "Terms of use")}</Link></div>
      </nav>
    </div>
  </footer>;
}
