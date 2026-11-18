"use client";

import { ArrowRight, ArrowUpRight, Bookmark, Clock3, Coins, Flame } from "lucide-react";
import { useSession } from "@/entities/session";
import { ActionLink } from "@/shared/ui/action-link";
import styles from "./personal-section.module.css";

const destinations = [
  { href: "/history", name: "История просмотра", detail: "Вернуться к начатой серии", icon: Clock3 },
  { href: "/favorites", name: "Избранное", detail: "Сериалы, отложенные на потом", icon: Bookmark },
  { href: "/rewards", name: "Ежедневные награды", detail: "Отметки и бонусные монеты", icon: Flame },
  { href: "/wallet", name: "Кошелёк", detail: "Баланс и история операций", icon: Coins },
];

export function PersonalSection() {
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
          Мой
          <br />
          кинотеатр
        </h2>
        <ActionLink className={styles.account} href={registered ? "/profile" : "/login"}>
          {registered ? "Открыть профиль" : "Войти в SONA"} <ArrowUpRight size={18} aria-hidden="true" />
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
