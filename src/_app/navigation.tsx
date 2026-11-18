"use client";

import * as Menu from "@animate-ui/react/primitives/radix-ui/dropdown-menu";
import { Bookmark, CircleUserRound, Clapperboard, History, House, SquarePlay } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderSearch } from "@/features/series-search/header-search";
import { ActionLink } from "@/shared/ui/action-link";
import { BrandIcon } from "@/shared/ui/brand-icon";
import { BrandMark } from "@/shared/ui/brand-mark";
import styles from "./navigation.module.css";

const home = { href: "/", label: "Главная", icon: "home" } as const;
const feed = { href: "/feed", label: "Лента", icon: "feed" } as const;
const catalog = { href: "/catalog", label: "Каталог", icon: "film" } as const;
const favorites = { href: "/favorites", label: "Избранное", icon: "bookmark" } as const;
const history = { href: "/history", label: "История просмотра", icon: "history" } as const;
const mobileIcons = { home: House, feed: SquarePlay, film: Clapperboard, bookmark: Bookmark };

export function Navigation() {
  const path = usePathname();
  return <>
    <header className={styles.header} data-home={path === "/"}>
      <div className={styles.bar}>
        <Link className={styles.logo} href="/" aria-label="SONA, главная" aria-current={path === "/" ? "page" : undefined}><BrandMark /></Link>
        <nav className={styles.desktop} aria-label="Основные разделы">
          {[feed, catalog].map(({ href, label }) => <ActionLink key={href} href={href} className={styles.navLink}
            aria-current={path === href ? "page" : undefined}>{label}</ActionLink>)}
          <Menu.Root key={path}>
            <Menu.Trigger className={styles.navLink} data-current={path === favorites.href || path === history.href}>
              Моя коллекция <BrandIcon name="chevron" size={13} />
            </Menu.Trigger>
            <Menu.Portal><Menu.Content className={styles.menu} sideOffset={12} align="center" collisionPadding={12}>
              {[favorites, history].map(({ href, label, icon }) => <Menu.Item key={href} asChild>
                <Link href={href} aria-current={path === href ? "page" : undefined}><BrandIcon name={icon} size={18} />{label}</Link>
              </Menu.Item>)}
            </Menu.Content></Menu.Portal>
          </Menu.Root>
        </nav>
        <nav className={styles.tools} aria-label="Поиск и личный кабинет">
          <HeaderSearch key={path} />
          <ActionLink className={`${styles.tool} ${styles.mobileHistory}`} href="/history" aria-label={history.label} aria-current={path === history.href ? "page" : undefined}><History size={20} strokeWidth={1.85} aria-hidden="true" /></ActionLink>
          <ActionLink className={`${styles.tool} ${styles.profile}`} href="/profile" aria-label="Профиль" aria-current={path === "/profile" ? "page" : undefined}><BrandIcon name="profile" size={18} className={styles.desktopIcon} /><CircleUserRound className={styles.phoneIcon} size={21} strokeWidth={1.85} aria-hidden="true" /><span>Профиль</span></ActionLink>
        </nav>
      </div>
    </header>
    <nav className={styles.mobile} aria-label="Основные разделы">
      {[home, feed, catalog, favorites].map(({ href, label, icon }) => {
        const Icon = mobileIcons[icon];
        return <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
          <Icon size={20} strokeWidth={1.85} aria-hidden="true" /><span>{label}</span>
        </Link>;
      })}
    </nav>
  </>;
}
