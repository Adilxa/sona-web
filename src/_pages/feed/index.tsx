"use client";

import { useI18n } from "@/shared/i18n/context";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { ArrowDown, ArrowRight, ArrowUp, Clapperboard, LockKeyhole, Play, Share2, ThumbsUp } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSession } from "@/entities/session";
import { useConfirmedLike, useSeriesSocialWrite } from "@/entities/series/model/social";
import { EpisodeCount } from "@/entities/series/ui/episode-count";
import { changeContent, getContent, requireSuccess } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { usePage } from "@/shared/lib/use-page";
import type { Locale } from "@/shared/i18n/model";
import { localizedPath, seriesPath } from "@/shared/seo/urls";
import { ActionLink } from "@/shared/ui/action-link";
import { BrandIcon } from "@/shared/ui/brand-icon";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { FeedActivity, type FeedItem } from "./activity";
import { retainFeedVideo, useFeedNetwork, waitForFeedVisibility } from "./network";
import { FeedVideo } from "./video";
import styles from "./feed.module.css";

type Schema = components["schemas"];

export async function fetchFeedPage(cursor: string, signal: AbortSignal) {
  await waitForFeedVisibility(signal);
  const path = cursor ? "feed?" + new URLSearchParams({ cursor }) : "feed";
  const data = await getContent<Schema["FeedPage"]>(path, signal);
  return {
    items: data.items.filter(item => item.kind === "series"),
    next: data.page.has_more && data.page.next_cursor !== cursor ? (data.page.next_cursor ?? "") : "",
  };
}

async function sendEvents(events: Schema["EventInput"][], keepalive: boolean) {
  if (!keepalive) return changeContent("events", "POST", { events });
  return requireSuccess(await fetch("/api/content/events", { method: "POST", keepalive: true,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events }) }));
}

function episodeLink(item: FeedItem, locale: Locale, position = 0) {
  const query = new URLSearchParams();
  if (item.first_episode_id) query.set("episode", String(item.first_episode_id));
  if (item.first_episode_id && position > 0) query.set("at", String(position));
  return localizedPath(seriesPath(item.series_id, item.slug) + (query.size ? "?" + query : ""), locale);
}

function FeedLike({ viewerId, item, activity }: { viewerId: string; item: FeedItem; activity: FeedActivity }) {
  const { t } = useI18n();
  const id = String(item.series_id);
  const liked = useConfirmedLike(viewerId, id);
  const mutation = useSeriesSocialWrite("like", viewerId, id, target => {
    if (target) activity.action(item, "like");
  });
  return <>
    <Button className={styles.icon} disabled={mutation.pending} aria-label={t("Нравится", "Like")} aria-pressed={liked}
      onClick={() => mutation.write(!liked)}>
      <ThumbsUp size={19} aria-hidden="true" />
    </Button>
    {mutation.failed && <span role="status" className={styles.feedback}>{mutation.error || t("Не удалось сохранить отметку.", "Couldn’t save your like.")}</span>}
  </>;
}

const Reel = memo(function Reel({ viewerId, item, active, near, locked, onDenied, network, activity }: {
  viewerId: string; item: FeedItem; active: boolean; near: boolean; locked: boolean; onDenied: (id: number) => void;
  network: ReturnType<typeof useFeedNetwork>; activity: FeedActivity;
}) {
  const { locale, t } = useI18n();
  const [position, setPosition] = useState(0);
  const [requested, setRequested] = useState(false);
  const autoplay = useRef(true);
  const onLocked = useCallback(() => onDenied(item.series_id), [onDenied, item.series_id]);
  const canPreview = Boolean(item.playback_url) && !locked;
  const [attached, setAttached] = useState(false);
  useLayoutEffect(() => {
    setAttached(previous => active && canPreview && retainFeedVideo(network, requested, previous));
  }, [active, canPreview, network, requested]);
  const [message, setMessage] = useState("");
  // Retain each snap position and its local progress without mounting every poster, control and link.
  if (!near) return <article className={styles.reel} inert aria-hidden="true" />;
  const share = async () => {
    const url = new URL(episodeLink(item, locale), window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: item.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setMessage(t("Ссылка скопирована", "Link copied"));
      }
      // Record the item on which the action was invoked, even if the user swiped before it finished.
      activity.action(item, "share");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(t("Не удалось поделиться ссылкой.", "Couldn’t share the link."));
    }
  };
  return <article className={styles.reel} inert={!active} aria-label={item.title}>
    <div className={styles.stage}>
      {attached && active && canPreview ? <FeedVideo item={item} activity={activity} position={position} onPosition={setPosition}
        autoplay={autoplay} onLocked={onLocked} />
        : (network === "auto" || (active && network === "manual")) && item.poster_url ? <img className={styles.media} src={item.poster_url} alt="" decoding="async" />
        : <Clapperboard aria-hidden="true" className={styles.placeholder} size={52} strokeWidth={1.2} />}
      {active && locked && <span className={styles.locked}><LockKeyhole size={16} aria-hidden="true" />{t("Серия закрыта", "Episode locked")}</span>}
      {active && canPreview && network === "manual" && !requested &&
        <Button className={styles.start} onClick={() => setRequested(true)}><Play size={18} fill="currentColor" aria-hidden="true" /> {t("Смотреть серию", "Watch episode")}</Button>}
    </div>
    <div className={styles.info}>
      {item.first_episode_id && <div className={styles.reelContext}><EpisodeCount current={1} /></div>}
      <h2>{item.title}</h2>
      <div className={styles.actions}>
        <ActionLink className={styles.watch} href={episodeLink(item, locale, position)} prefetch={false}>
          {locked ? t("Варианты доступа", "Unlock options") : canPreview ? t("Смотреть дальше", "Keep watching") : t("О сериале", "Series details")} <ArrowRight size={17} aria-hidden="true" />
        </ActionLink>
        <FeedLike viewerId={viewerId} item={item} activity={activity} />
        <Button className={styles.icon} aria-label={t("Поделиться сериалом", "Share series")} onClick={share}><Share2 size={18} aria-hidden="true" /></Button>
      </div>
      {message && <p className={styles.feedback} role="status">{message}</p>}
    </div>
  </article>;
});

function Feed({ viewerId, restart }: { viewerId: string; restart: () => void }) {
  const { t } = useI18n();
  const page = usePage(fetchFeedPage);
  const network = useFeedNetwork();
  const items = useMemo(() => {
    const seen = new Set<number>();
    return page.items.filter(item => {
      if (seen.has(item.series_id)) return false;
      seen.add(item.series_id);
      return true;
    });
  }, [page.items]);
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [denied, setDenied] = useState(() => new Set<number>());
  const markDenied = useCallback((id: number) => setDenied(old => old.has(id) ? old : new Set(old).add(id)), []);
  const isLocked = (item: FeedItem) => denied.has(item.series_id) || Boolean(item.first_episode_id && !item.playback_url);
  const [activity] = useState(() => new FeedActivity(sendEvents));
  const current = items[active];
  useLayoutEffect(() => {
    const show = () => { if (current && !document.hidden) activity.show(current); };
    show();
    document.addEventListener("visibilitychange", show);
    return () => document.removeEventListener("visibilitychange", show);
  }, [current, activity]);
  useEffect(() => {
    const restoreSnap = () => {
      const node = viewport.current;
      if (!document.hidden && node && node.clientHeight && Math.round(node.scrollTop / node.clientHeight) !== active) {
        node.scrollTo({ top: active * node.clientHeight, behavior: "instant" });
      }
    };
    document.addEventListener("visibilitychange", restoreSnap);
    return () => document.removeEventListener("visibilitychange", restoreSnap);
  }, [active]);
  useEffect(() => {
    const flush = () => { activity.watchTime(); void activity.flush(); };
    const hide = () => { activity.pause(); void activity.flush(true); };
    const visibility = () => { if (document.hidden) hide(); };
    const timer = window.setInterval(flush, 5000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      hide();
    };
  }, [activity]);

  useEffect(() => {
    const threshold = network === "auto" ? 2 : 1;
    if (network !== "hidden" && page.next && !page.busy && !page.error && active >= items.length - threshold) page.more();
  }, [page, active, items.length, network]);

  const go = useCallback((index: number) => {
    const node = viewport.current;
    if (document.hidden || !node || index < 0 || index >= items.length) return;
    node.scrollTo({ top: index * node.clientHeight,
      behavior: Math.abs(index * node.clientHeight - node.scrollTop) > node.clientHeight * 1.5
        || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [items.length]);
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLVideoElement || event.altKey || event.ctrlKey || event.metaKey) return;
    if (["ArrowDown", "PageDown", "ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      go(active + (event.key === "ArrowDown" || event.key === "PageDown" ? 1 : -1));
    }
  };
  if (!items.length) return <div className={styles.state} aria-live="polite">
    {page.error ? <><h2>{t("Не удалось загрузить ленту", "Couldn’t load the feed")}</h2><p>{page.error}</p><Button onClick={page.retry}>{t("Повторить", "Try again")}</Button></>
      : page.busy || page.next ? <SonaLoader label={t("Загружаем сериалы", "Loading series")} />
      : <><Clapperboard aria-hidden="true" size={36} /><h2>{t("В ленте пока нет сериалов", "The feed is empty for now")}</h2>
        <ActionLink className={styles.watch} href="/catalog">{t("В каталог", "Browse series")} <ArrowRight size={17} aria-hidden="true" /></ActionLink></>}
  </div>;
  const queueStart = Math.min(active, Math.max(0, items.length - 4));
  return <div className={styles.layout}>
    <div className={styles.viewport} tabIndex={0} aria-label={t("Сериалы в ленте", "Series feed")} role="region"
      ref={viewport} onKeyDown={onKey} onScroll={({ currentTarget }) => {
        if (!document.hidden && currentTarget.clientHeight > 0) {
          setActive(Math.max(0, Math.min(items.length - 1, Math.round(currentTarget.scrollTop / currentTarget.clientHeight))));
        }
      }}>
      {items.map((item, index) => <Reel key={item.series_id} viewerId={viewerId} item={item} active={index === active} activity={activity} locked={isLocked(item)} onDenied={markDenied}
        network={network} near={Math.abs(index - active) <= 1} />)}
    </div>
    <aside className={styles.sidebar} aria-label={t("Очередь просмотра", "Watch queue")}>
      <div className={styles.queue}>
        <h2>{t("В ленте", "In the feed")}</h2>
        <ol>
          {items.slice(queueStart, queueStart + 4).map((item, offset) => {
            const index = queueStart + offset;
            const selected = index === active;
            const closed = isLocked(item);
            return <li key={item.series_id}><Button className={styles.queueItem} onClick={() => go(index)} aria-current={selected ? "true" : undefined}>
              <span className={styles.queuePoster}>
                <BrandIcon name="film" size={17} />
                {network === "auto" && item.poster_url && <picture>
                  <source media="(min-width: 900px)" srcSet={item.poster_url} />
                  <img alt="" width="46" height="60" loading="lazy" decoding="async" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
                </picture>}
              </span>
              <span className={styles.queueCopy}><strong>{item.title}</strong>
                {closed ? <small><LockKeyhole aria-hidden="true" size={11} /> {t("Закрыта", "Locked")}</small> : selected ? <small>{t("На экране", "Now showing")}</small> : null}
              </span>
              {selected && !closed && <Play aria-hidden="true" size={13} fill="currentColor" />}
            </Button></li>;
          })}
        </ol>
      </div>
      <div className={styles.navigation} role="group" aria-label={t("Листать сериалы", "Browse the feed")} onKeyDown={onKey}>
      <Button className={styles.icon} aria-label={t("Предыдущий сериал", "Previous series")} disabled={active === 0} onClick={() => go(active - 1)}>
        <ArrowUp aria-hidden="true" size={21} />
      </Button>
      <Button className={styles.icon} aria-label={t("Следующий сериал", "Next series")} disabled={active === items.length - 1} onClick={() => go(active + 1)}>
        <ArrowDown aria-hidden="true" size={21} />
      </Button>
      </div>
    </aside>
    {page.busy && active === items.length - 1 && <div className={styles.pageLoading}><SonaLoader label={t("Загружаем сериалы", "Loading series")} /></div>}
    {page.error && <div className={styles.pageError} role="alert"><span>{page.error}</span>
      <Button onClick={page.retry}>{t("Повторить", "Try again")}</Button><Button onClick={restart}>{t("Начать заново", "Start over")}</Button></div>}
  </div>;
}

export function FeedPage() {
  const { locale, t } = useI18n();
  const { me, error, reload } = useSession();
  const [version, setVersion] = useState(0);
  return <section className={styles.page} data-view="feed" aria-labelledby="feed-title">
    <h1 id="feed-title">{t("Лента", "Feed")}</h1>
    {error ? <div className={styles.state} role="alert"><p>{error}</p><Button onClick={reload}>{t("Повторить", "Try again")}</Button></div>
      : me ? <Feed viewerId={String(me.id)} key={JSON.stringify([me.id, me.role, locale, version])} restart={() => setVersion(v => v + 1)} />
      : <div className={styles.state}><SonaLoader label={t("Загружаем сериалы", "Loading series")} /></div>}
  </section>;
}
