"use client";

import { useI18n } from "@/shared/i18n/context";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import {
  ArrowUpRight, Bookmark, ChevronRight, Coins, Gift, Globe2, History, LockKeyhole,
  LogOut, Mail, MonitorSmartphone, Play, RotateCcw, Wallet, type LucideIcon,
} from "lucide-react";
import { authenticate, useSession } from "@/entities/session";
import { findSeries } from "@/entities/series";
import { EpisodeCount } from "@/entities/series/ui/episode-count";
import { SeriesSaveButton } from "@/entities/series/ui/series-card-social";
import { getContent } from "@/shared/api/content";
import { localizedPath, seriesPath } from "@/shared/seo/urls";
import type { components } from "@/shared/api/schema";
import { ActionLink } from "@/shared/ui/action-link";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { InteriorPage } from "@/shared/ui/interior-page";
import { NotificationSettings } from "./notification-settings";
import styles from "./profile.module.css";

type Schema = components["schemas"];
type Recent = Schema["ContinueWatchingItem"];
type Card = Awaited<ReturnType<typeof findSeries>>;

const accountLinks = (t: (russian: string, english: string) => string) => [
  { href: "/wallet", label: t("Кошелёк", "Wallet"), icon: Wallet },
  { href: "/shop", label: t("Магазин монет", "Coin shop"), icon: Coins },
  { href: "/rewards", label: t("Ежедневные награды", "Daily rewards"), icon: Gift },
  { href: "/settings", label: t("Язык и часовой пояс", "Language and time zone"), icon: Globe2 },
  { href: "/devices", label: t("Устройства и сеансы", "Devices and sessions"), icon: MonitorSmartphone },
  { href: "/login?link=email", label: t("Привязать почту", "Link email"), icon: Mail },
];

function ProfileLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return <ActionLink href={href} prefetch={false} className={styles.row}>
    <Icon size={19} strokeWidth={1.75} aria-hidden="true" /><span>{label}</span><ChevronRight size={15} aria-hidden="true" />
  </ActionLink>;
}

function ResumeRow({ card, recent, me }: { card: Card; recent: Recent; me: Schema["Me"] }) {
  const { locale, t } = useI18n();
  const [failed, setFailed] = useState<string[]>([]);
  const cover = [card.poster, card.landscape].find(src => src && !failed.includes(src));
  const position = Math.max(0, recent.position_sec);
  const duration = recent.duration_sec ?? 0;
  const query = new URLSearchParams({ episode: String(recent.episode_id), at: String(recent.completed ? 0 : position) });
  const lock = me.role === "guest" && recent.episode_number > card.freeEpisodesCount;
  const time = Math.floor(position / 60) + ":" + String(position % 60).padStart(2, "0");
  const Icon = lock ? LockKeyhole : recent.completed ? RotateCcw : Play;
  const label = lock ? t("Открыть серию", "Unlock episode") : recent.completed ? t("Смотреть снова", "Watch again") : position > 0 ? t(`Продолжить с ${time}`, `Resume at ${time}`) : t("Продолжить", "Continue");

  return <article className={styles.resume} data-art={Boolean(cover)}>
    <ActionLink className={styles.resumeLink} prefetch={false} href={localizedPath(`${seriesPath(card.id, card.slug)}?${query}`, locale)}>
      {cover && <span className={styles.thumbnail}><img src={cover} alt="" decoding="async" onError={() => setFailed(previous => [...previous, cover])} /></span>}
      <span className={styles.copy}>
        <EpisodeCount current={recent.episode_number} total={card.episodesCount} />
        <strong>{card.title}</strong>
        {duration > 0 && <progress aria-label={t("Прогресс просмотра", "Watch progress")} max={duration} value={Math.min(position, duration)} />}
        <span className={styles.play}><Icon size={15} fill={Icon === Play ? "currentColor" : "none"} aria-hidden="true" />{label}</span>
      </span>
    </ActionLink>
    <div className={styles.save}><SeriesSaveButton seriesId={card.id} title={card.title} viewerId={me.id} compact /></div>
  </article>;
}

function Watching({ me }: { me: Schema["Me"] }) {
  const { t, locale } = useI18n();
  const history = useQuery({
    queryKey: ["profile-history", me.id, me.locale || locale], staleTime: 0,
    queryFn: async ({ signal }) => {
      const data = await getContent<Schema["ContinueWatching"]>("me/continue-watching", signal);
      const recent = data.items.find(row => !row.completed) ?? data.items[0];
      if (!recent) return null;
      const card = await findSeries(String(recent.series_id), signal);
      return { card, recent };
    },
  });
  return <section className={styles.watching} aria-labelledby="viewing-heading">
    <h2 id="viewing-heading">{t("Мой просмотр", "My viewing")}</h2>
    {history.isPending ? <SonaLoader label={t("Загружаем историю просмотра…", "Loading your watch history…")} /> :
      history.isError ? <p role="alert">{t("Не удалось загрузить историю.", "Couldn’t load your watch history.")} <button onClick={() => history.refetch()}>{t("Повторить", "Try again")}</button></p> :
      history.data ? <ResumeRow key={history.data.card.id} {...history.data} me={me} /> :
      <div className={styles.firstWatch}><h3>{t("Что посмотрим первым?", "What would you like to watch first?")}</h3><ActionLink className={styles.primary} href="/feed"><Play size={16} fill="currentColor" aria-hidden="true" /> {t("Открыть ленту", "Explore the feed")}</ActionLink></div>}
    <nav className={styles.collection} aria-label={t("Коллекция зрителя", "Your collection")}>
      <ProfileLink href="/favorites" label={t("Избранное", "Favorites")} icon={Bookmark} />
      <ProfileLink href="/history" label={t("История", "History")} icon={History} />
    </nav>
  </section>;
}

export function ProfilePage() {
  const { locale, t } = useI18n();
  const { me, error, reload } = useSession();
  const [notice, setNotice] = useState<{ date: string } | "restored">();
  const router = useRouter();
  const logout = useMutation({ mutationFn: () => authenticate("logout"), onSuccess: () => router.replace("/login") });
  useEffect(() => {
    const date = sessionStorage.getItem("sona-deleted");
    if (date) setNotice({ date });
    if (sessionStorage.getItem("sona-restored")) setNotice("restored");
    sessionStorage.removeItem("sona-deleted");
    sessionStorage.removeItem("sona-restored");
  }, []);
  const deletionDate = notice && notice !== "restored" ? new Date(notice.date).toLocaleString(locale) : "";
  const guest = me?.role === "guest";
  return <InteriorPage title={t("Профиль", "Profile")} back={{ href: "/", label: t("Главная", "Home") }}
    description={me && (guest ? t("Гостевой просмотр на этом устройстве", "Browsing as a guest on this device") : t("Аккаунт SONA · ", "SONA account · ") + me.timezone.replaceAll("_", " "))}
    actions={guest && <Link className={styles.primary} href="/login">{t("Войти или зарегистрироваться", "Sign in or create an account")} <ArrowUpRight size={17} aria-hidden="true" /></Link>}>
    {notice && <p role="status">{notice === "restored" ? t("Удаление аккаунта отменено.", "Account deletion canceled.") : t(
      `Удаление запланировано на ${deletionDate}. Вход до этой даты отменит удаление.`,
      `Deletion scheduled for ${deletionDate}. Sign in before then to cancel deletion.`,
    )}</p>}
    {!me && (error ? <p role="alert">{error} <button onClick={reload}>{t("Повторить", "Try again")}</button></p> : <SonaLoader label={t("Загружаем профиль…", "Loading your profile…")} />)}
    {me && <div className={styles.columns}>
      <Watching key={me.id} me={me} />
      <section className={styles.settings} aria-label={guest ? t("Настройки", "Settings") : t("Мой аккаунт", "My account")}>
        {!guest && <><h2>{t("Мой аккаунт", "My account")}</h2>
          <nav className={styles.accountMenu} aria-label={t("Разделы аккаунта", "Account sections")}>
            {accountLinks(t).map(link => <ProfileLink key={link.href} {...link} />)}
          </nav>
        </>}
        <NotificationSettings key={me.id} viewerId={me.id} />
        {!guest && <><Button type="button" className={styles.logOut} disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut size={17} aria-hidden="true" />{logout.isPending ? t("Выходим…", "Signing out…") : t("Выйти", "Sign out")}</Button>
          {logout.isError && <p role="alert">{t("Не удалось выйти. Попробуйте ещё раз.", "Couldn’t sign out. Try again.")}</p>}</>}
      </section>
    </div>}
  </InteriorPage>;
}
