import Link from "next/link";
import { BrandMark } from "@/shared/ui/brand-mark";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  return <footer className={styles.footer}>
    <div className={styles.inner}>
      <Link href="/" aria-label="SONA, главная" className={styles.wordmark}><BrandMark /></Link>
      <nav aria-label="Разделы в подвале">
        <div><strong>Смотреть</strong><Link href="/feed">Лента</Link><Link href="/catalog">Каталог сериалов</Link></div>
        <div><strong>Моя коллекция</strong><Link href="/history">История просмотра</Link><Link href="/favorites">Избранное</Link><Link href="/profile">Профиль</Link></div>
      </nav>
    </div>
  </footer>;
}
