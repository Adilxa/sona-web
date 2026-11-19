"use client";

import * as Menu from "@animate-ui/react/primitives/radix-ui/dropdown-menu";
import { Bookmark, CircleUserRound, Clapperboard, History, House, SquarePlay } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderSearch } from "@/features/series-search/header-search";
import { ActionLink } from "@/shared/ui/action-link";
import { BrandIcon } from "@/shared/ui/brand-icon";
import { BrandMark } from "@/shared/ui/brand-mark";
import { useI18n } from "@/shared/i18n/context";
import { localizedPath } from "@/shared/seo/urls";
import styles from "./navigation.module.css";

const home = { href: "/", label: ["Главная", "Home"], icon: "home" } as const;
const feed = { href: "/feed", label: ["Лента", "Feed"], icon: "feed" } as const;
const catalog = { href: "/catalog", label: ["Каталог", "Catalog"], icon: "film" } as const;
const favorites = { href: "/favorites", label: ["Избранное", "Favorites"], icon: "bookmark" } as const;
const history = { href: "/history", label: ["История просмотра", "Watch history"], icon: "history" } as const;
const mobileIcons = { home: House, feed: SquarePlay, film: Clapperboard, bookmark: Bookmark };

export function Navigation() {
  const { t, locale } = useI18n();
  const path = usePathname();
  return <>
    <header className={styles.header} data-home={path === "/"}>
      <div className={styles.bar}>
        <Link className={styles.logo} href={localizedPath("/", locale)} aria-label={t("SONA, главная", "SONA, home")} aria-current={path === "/" ? "page" : undefined}><BrandMark /></Link>
        <nav className={styles.desktop} aria-label={t("Основные разделы", "Main navigation")}>
          {[feed, catalog].map(({ href, label }) => <ActionLink key={href} href={localizedPath(href, locale)} className={styles.navLink}
            aria-current={path === href ? "page" : undefined}>{t(label[0], label[1])}</ActionLink>)}
          <Menu.Root key={path}>
            <Menu.Trigger className={styles.navLink} data-current={path === favorites.href || path === history.href}>
              {t("Моя коллекция", "My collection")} <BrandIcon name="chevron" size={13} />
            </Menu.Trigger>
            <Menu.Portal><Menu.Content className={styles.menu} sideOffset={12} align="center" collisionPadding={12}>
              {[favorites, history].map(({ href, label, icon }) => <Menu.Item key={href} asChild>
                <Link href={href} aria-current={path === href ? "page" : undefined}><BrandIcon name={icon} size={18} />{t(label[0], label[1])}</Link>
              </Menu.Item>)}
            </Menu.Content></Menu.Portal>
          </Menu.Root>
        </nav>
        <nav className={styles.tools} aria-label={t("Поиск и личный кабинет", "Search and account")}>
          <HeaderSearch key={path} />
          <ActionLink className={`${styles.tool} ${styles.mobileHistory}`} href="/history" aria-label={t(...history.label)} aria-current={path === history.href ? "page" : undefined}><History size={20} strokeWidth={1.85} aria-hidden="true" /></ActionLink>
          <ActionLink className={`${styles.tool} ${styles.profile}`} href="/profile" aria-label={t("Профиль", "Profile")} aria-current={path === "/profile" ? "page" : undefined}><BrandIcon name="profile" size={18} className={styles.desktopIcon} /><CircleUserRound className={styles.phoneIcon} size={21} strokeWidth={1.85} aria-hidden="true" /><span>{t("Профиль", "Profile")}</span></ActionLink>
        </nav>
      </div>
    </header>
    <nav className={styles.mobile} aria-label={t("Основные разделы", "Main navigation")}>
      {[home, feed, catalog, favorites].map(({ href, label, icon }) => {
        const Icon = mobileIcons[icon];
        return <Link key={href} href={href === "/favorites" ? href : localizedPath(href, locale)} aria-current={path === href ? "page" : undefined}>
          <Icon size={20} strokeWidth={1.85} aria-hidden="true" /><span>{t(label[0], label[1])}</span>
        </Link>;
      })}
    </nav>
  </>;
}
