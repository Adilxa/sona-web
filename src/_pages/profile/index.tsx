"use client";

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
import type { components } from "@/shared/api/schema";
import { ActionLink } from "@/shared/ui/action-link";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { InteriorPage } from "@/shared/ui/interior-page";
import { NotificationSettings } from "./notification-settings";
import styles from "./profile.module.css";

type Schema = components["schemas"];
type Recent = Schema["ContinueWatchingItem"];
type Card = Awaited<ReturnType<typeof findSeries>>;

const accountLinks = [
  { href: "/wallet", label: "Кошелёк", icon: Wallet },
  { href: "/shop", label: "Магазин монет", icon: Coins },
  { href: "/rewards", label: "Ежедневные награды", icon: Gift },
  { href: "/settings", label: "Язык и часовой пояс", icon: Globe2 },
  { href: "/devices", label: "Устройства и сеансы", icon: MonitorSmartphone },
  { href: "/login?link=email", label: "Привязать почту", icon: Mail },
];

function ProfileLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return <ActionLink href={href} prefetch={false} className={styles.row}>
    <Icon size={19} strokeWidth={1.75} aria-hidden="true" /><span>{label}</span><ChevronRight size={15} aria-hidden="true" />
  </ActionLink>;
}

function ResumeRow({ card, recent, me }: { card: Card; recent: Recent; me: Schema["Me"] }) {
  const [failed, setFailed] = useState<string[]>([]);
  const cover = [card.poster, card.landscape].find(src => src && !failed.includes(src));
  const position = Math.max(0, recent.position_sec);
  const duration = recent.duration_sec ?? 0;
  const query = new URLSearchParams({ episode: String(recent.episode_id), at: String(recent.completed ? 0 : position) });
  const lock = me.role === "guest" && recent.episode_number > card.freeEpisodesCount;
  const time = Math.floor(position / 60) + ":" + String(position % 60).padStart(2, "0");
  const Icon = lock ? LockKeyhole : recent.completed ? RotateCcw : Play;
  const label = lock ? "Открыть серию" : recent.completed ? "Смотреть снова" : position > 0 ? `Продолжить с ${time}` : "Продолжить";

  return <article className={styles.resume} data-art={Boolean(cover)}>
    <ActionLink className={styles.resumeLink} prefetch={false} href={`/series/${encodeURIComponent(card.id)}?${query}`}>
      {cover && <span className={styles.thumbnail}><img src={cover} alt="" decoding="async" onError={() => setFailed(previous => [...previous, cover])} /></span>}
      <span className={styles.copy}>
        <EpisodeCount current={recent.episode_number} total={card.episodesCount} />
        <strong>{card.title}</strong>
        {duration > 0 && <progress aria-label="Прогресс просмотра" max={duration} value={Math.min(position, duration)} />}
        <span className={styles.play}><Icon size={15} fill={Icon === Play ? "currentColor" : "none"} aria-hidden="true" />{label}</span>
      </span>
    </ActionLink>
    <div className={styles.save}><SeriesSaveButton seriesId={card.id} title={card.title} viewerId={me.id} compact /></div>
  </article>;
}

function Watching({ me }: { me: Schema["Me"] }) {
  const history = useQuery({
    queryKey: ["profile-history", me.id, me.locale], staleTime: 0,
    queryFn: async ({ signal }) => {
      const data = await getContent<Schema["ContinueWatching"]>("me/continue-watching", signal);
      const recent = data.items.find(row => !row.completed) ?? data.items[0];
      if (!recent) return null;
      const card = await findSeries(String(recent.series_id), signal);
      return { card, recent };
    },
  });
  return <section className={styles.watching} aria-labelledby="viewing-heading">
    <h2 id="viewing-heading">Мой просмотр</h2>
    {history.isPending ? <SonaLoader label="Загружаем историю просмотра…" /> :
      history.isError ? <p role="alert">Не удалось загрузить историю. <button onClick={() => history.refetch()}>Повторить</button></p> :
      history.data ? <ResumeRow key={history.data.card.id} {...history.data} me={me} /> :
      <div className={styles.firstWatch}><h3>Что посмотрим первым?</h3><ActionLink className={styles.primary} href="/feed"><Play size={16} fill="currentColor" aria-hidden="true" /> Открыть ленту</ActionLink></div>}
    <nav className={styles.collection} aria-label="Коллекция зрителя">
      <ProfileLink href="/favorites" label="Избранное" icon={Bookmark} />
      <ProfileLink href="/history" label="История" icon={History} />
    </nav>
  </section>;
}

export function ProfilePage() {
  const { me, error, reload } = useSession();
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const logout = useMutation({ mutationFn: () => authenticate("logout"), onSuccess: () => router.replace("/login") });
  useEffect(() => {
    const date = sessionStorage.getItem("sona-deleted");
    if (date) setNotice("Удаление запланировано на " + new Date(date).toLocaleString("ru") + ". Вход до этой даты отменит удаление.");
    if (sessionStorage.getItem("sona-restored")) setNotice("Удаление аккаунта отменено.");
    sessionStorage.removeItem("sona-deleted");
    sessionStorage.removeItem("sona-restored");
  }, []);
  const guest = me?.role === "guest";
  return <InteriorPage title="Профиль" back={{ href: "/", label: "Главная" }}
    description={me && (guest ? "Гостевой просмотр на этом устройстве" : "Аккаунт SONA · " + me.timezone.replaceAll("_", " "))}
    actions={guest && <Link className={styles.primary} href="/login">Войти или зарегистрироваться <ArrowUpRight size={17} aria-hidden="true" /></Link>}>
    {notice && <p role="status">{notice}</p>}
    {!me && (error ? <p role="alert">{error} <button onClick={reload}>Повторить</button></p> : <SonaLoader label="Загружаем профиль…" />)}
    {me && <div className={styles.columns}>
      <Watching key={me.id} me={me} />
      <section className={styles.settings} aria-label={guest ? "Настройки" : "Мой аккаунт"}>
        {!guest && <><h2>Мой аккаунт</h2>
          <nav className={styles.accountMenu} aria-label="Разделы аккаунта">
            {accountLinks.map(link => <ProfileLink key={link.href} {...link} />)}
          </nav>
        </>}
        <NotificationSettings key={me.id} viewerId={me.id} />
        {!guest && <><Button type="button" className={styles.logOut} disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut size={17} aria-hidden="true" />{logout.isPending ? "Выходим…" : "Выйти"}</Button>
          {logout.isError && <p role="alert">Не удалось выйти. Попробуйте ещё раз.</p>}</>}
      </section>
    </div>}
  </InteriorPage>;
}
