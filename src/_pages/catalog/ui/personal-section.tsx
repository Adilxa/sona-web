"use client";

import { useI18n } from "@/shared/i18n/context";
import { ArrowRight, ArrowUpRight, Bookmark, Clock3, Coins, Flame } from "lucide-react";
import { useSession } from "@/entities/session";
import { ActionLink } from "@/shared/ui/action-link";
import styles from "./personal-section.module.css";

export function PersonalSection() {
  const { t } = useI18n();
  const destinations = [
    { href: "/history", name: t("История просмотра", "Watch history"), detail: t("Вернуться к начатой серии", "Pick up where you left off"), icon: Clock3 },
    { href: "/favorites", name: t("Избранное", "Favorites"), detail: t("Сериалы, отложенные на потом", "Series saved for later"), icon: Bookmark },
    { href: "/rewards", name: t("Ежедневные награды", "Daily rewards"), detail: t("Отметки и бонусные монеты", "Check-ins and bonus coins"), icon: Flame },
    { href: "/wallet", name: t("Кошелёк", "Wallet"), detail: t("Баланс и история операций", "Balance and transactions"), icon: Coins },
  ];

  const { me } = useSession();
  const registered = me?.role === "user";

  return (
    <section className={styles.section} aria-labelledby="collection-heading">
      <div className={styles.poster}>
        <img
          className={styles.sculpture}
          src="/art/sona-loop.webp"
          width={1250}
          height={820}
          loading="lazy"
          decoding="async"
          alt=""
        />
        <h2 id="collection-heading">
          {t("Мой", "My")}
          <br />
          {t("кинотеатр", "cinema")}
        </h2>
        <ActionLink className={styles.account} href={registered ? "/profile" : "/login"}>
          {registered ? t("Открыть профиль", "Open profile") : t("Войти в SONA", "Sign in to SONA")} <ArrowUpRight size={18} aria-hidden="true" />
        </ActionLink>
      </div>
      <nav className={styles.destinations} aria-labelledby="collection-heading">
        {destinations.map(({ href, name, detail, icon: Icon }) => (
          <ActionLink className={styles.destination} key={href} href={href}>
            <span className={styles.icon}>
              <Icon size={20} strokeWidth={1.55} aria-hidden="true" />
            </span>
            <span className={styles.copy}>
              <strong>{name}</strong>
              <small>{detail}</small>
            </span>
            <ArrowRight className={styles.arrow} size={19} aria-hidden="true" />
          </ActionLink>
        ))}
      </nav>
    </section>
  );
}
