"use client";

import { useI18n } from "@/shared/i18n/context";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { ArrowLeft, ChevronDown, Clapperboard, ListVideo, LockKeyhole, Minimize2, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { findSeries, listEpisodes, playback } from "@/entities/series";
import { EpisodeCount } from "@/entities/series/ui/episode-count";
import { useSession } from "@/entities/session";
import { getContent, SonaError } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { usePage } from "@/shared/lib/use-page";
import type { PublicSeries } from "@/shared/seo/catalog.server";
import { localizedPath, seriesPath } from "@/shared/seo/urls";
import { ActionLink } from "@/shared/ui/action-link";
import { InteriorBack } from "@/shared/ui/interior-page";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { EpisodeEndCard } from "./episode-end-card";
import { AccessWall } from "./access-wall";
import { Player } from "./player";
import { NextEpisodeBuffer, type WarmEpisode } from "./next-episode";
import { SeriesSocialActions } from "./series-social-actions";
import { useReelSwipe } from "./use-reel-swipe";
import { mediaTime } from "./player-gesture";
import styles from "./details.module.css";

type Schema = components["schemas"];
type Props = { id: string; episode: number; at: number; autoStart?: boolean; summary?: PublicSeries };
type Playing = { id: number; stream?: Schema["Playback"]; warm?: WarmEpisode; lock?: Schema["LockedProblem"]; error?: "unavailable" | "load" | SonaError };

function subscribeSize(update: () => void) {
  const query = window.matchMedia("(max-width: 760px)");
  query.addEventListener("change",update);
  return () => query.removeEventListener("change",update);
}
const smallScreen = () => window.matchMedia("(max-width: 760px)").matches;

function Synopsis({ title, description, genres, releaseState }: {
  title: string; description?: string; genres: string[]; releaseState?: "completed" | "ongoing";
}) {
  const { t } = useI18n();
  return <>
    <h1 id="series-title">{title}</h1>
    {(genres.length > 0 || releaseState) && <div className={styles.meta}>
      {genres.map((genre, i) => <span key={i}>{genre}</span>)}
      {releaseState && <span>{releaseState === "completed" ? t("Завершён", "Completed") : t("Выходит", "Ongoing")}</span>}
    </div>}
    {description && <section className={styles.about} aria-labelledby="series-about-title">
      <h2 id="series-about-title">{t("О сериале", "About the series")}</h2>
      <p>{description}</p>
    </section>}
  </>;
}

export function SeriesDetailsPage(props: Props) {
  const { t } = useI18n();
  const { me, error, reload } = useSession();
  if (!me) {
    const status = error ? <p role="alert">{error} <Button onClick={reload}>{t("Повторить", "Retry")}</Button></p> :
      <SonaLoader label={t("Загружаем сериал", "Loading series")} />;
    const { summary } = props;
    if (!summary) return <div className={styles.article}>{status}</div>;
    return <article className={styles.article} data-view="watch">
      <div className={styles.columns}>
        <div className={styles.theater}><div className={styles.screen}>
          {summary.image && <img className={styles.poster} src={summary.image} alt="" />}
          <div className={styles.overlay}>{status}</div>
        </div></div>
        <aside className={styles.details} aria-labelledby="series-title">
          <InteriorBack href="/catalog" label={t("Каталог", "Catalog")} />
          <Synopsis title={summary.title} description={summary.description} genres={summary.genres} />
          <EpisodeCount total={summary.episodesCount} />
        </aside>
      </div>
    </article>;
  }
  return <Watch key={JSON.stringify([props.id, props.episode, props.at, props.autoStart, me.id, me.role])} {...props} guest={me.role === "guest"} />;
}

function Watch({ id, episode, at, autoStart, guest, summary }: Props & { guest: boolean }) {
  const { locale, t } = useI18n();
  const [series, setSeries] = useState<Awaited<ReturnType<typeof findSeries>>>();
  const [warmer] = useState(() => new NextEpisodeBuffer(playback));
  const [allEpisodes, setAllEpisodes] = useState(false);
  const [selected, setSelected] = useState(episode);
  const [arriving, setArriving] = useState<number>();
  const [position, setPosition] = useState(at);
  const [history, setHistory] = useState<Schema["ContinueWatchingItem"] | null>();
  const [result, setResult] = useState<Playing>();
  const [ended, setEnded] = useState(false);
  const [swipedAfterEnd, setSwipedAfterEnd] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<SonaError | true>();
  const [attempt, setAttempt] = useState(0);
  const [playAttempt, setPlayAttempt] = useState(0);

  const mobile = useSyncExternalStore(subscribeSize,smallScreen,() => false);
  const immersive = mobile && selected > 0;
  const sheet = useRef<HTMLDialogElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetExit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(sheetExit.current), [immersive]);
  const closeSheet = useCallback(() => {
    const dialog = sheet.current;
    if (!dialog?.open || dialog.dataset.closing === "true") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.close();
      return;
    }
    dialog.dataset.closing = "true";
    // Keep focus trapped through the exit. Also finish if the animation is interrupted.
    sheetExit.current = setTimeout(() => { if (dialog.open) dialog.close(); }, 280);
  }, []);
  const [hint, setHint] = useState(true);
  const load = useCallback((cursor: string, signal: AbortSignal) => listEpisodes(id, cursor, signal), [id, locale]);
  const episodes = usePage(load);
  const ordered = [...episodes.items].sort((left, right) => left.number - right.number);
  const index = ordered.findIndex(item => item.id === selected);
  const current = ordered[index];
  const currentId = current?.id;
  const next = index >= 0 ? ordered[index + 1] : undefined;
  const previous = index > 0 ? ordered[index - 1] : undefined;
  const active = currentId && result?.id === currentId ? result : undefined;
  const savedIndex = ordered.findIndex(item => item.id === history?.episode_id);
  const resume = savedIndex >= 0 ? ordered[savedIndex + (history?.completed ? 1 : 0)] : undefined;
  const firstChoice = resume ?? ordered[0];
  const savedPosition = resume && !history?.completed ? history?.position_sec ?? 0 : 0;
  let startLabel = t("Смотреть с первой серии", "Watch from episode 1");
  if (firstChoice?.locked) {
    startLabel = t(`Открыть серию ${firstChoice.number}`, `Unlock episode ${firstChoice.number}`);
  } else if (resume) {
    startLabel = savedPosition
      ? t(`Продолжить · серия ${resume.number} с ${mediaTime(savedPosition)}`, `Resume episode ${resume.number} at ${mediaTime(savedPosition)}`)
      : t(`Продолжить · серия ${resume.number}`, `Resume episode ${resume.number}`);
  }
  const total = series?.episodesCount ?? summary?.episodesCount ?? (ordered.length || undefined);
  const poster = series?.poster ?? summary?.image;
  const queueStart = Math.max(0, Math.min(Math.max(0,index - 1), ordered.length - 4));
  const queue = allEpisodes ? ordered : ordered.slice(queueStart,queueStart + 4);
  const locked = current?.locked;

  useEffect(() => () => warmer.clear(), [warmer]);
  useEffect(() => {
    if (!immersive || !currentId || (!next && !previous) || !hint) return;
    const timer = window.setTimeout(() => setHint(false), 3800);
    return () => clearTimeout(timer);
  },[immersive,currentId,Boolean(next),Boolean(previous),hint]);

  useEffect(() => {
    if (episode) return;
    const controller = new AbortController();
    getContent<Schema["ContinueWatching"]>("me/continue-watching", controller.signal).then(({ items }) => {
      if (!controller.signal.aborted) setHistory(items.find(item => String(item.series_id) === id) ?? null);
    }).catch(() => { if (!controller.signal.aborted) setHistory(null); });
    return () => controller.abort();
  }, [id, episode]);

  useEffect(() => {
    const controller = new AbortController();
    setError(undefined);
    findSeries(id, controller.signal).then(card => {
      if (!controller.signal.aborted) setSeries(card);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof SonaError ? reason : true);
    });
    return () => controller.abort();
  }, [id, attempt, locale]);

  useEffect(() => {
    if (!currentId) return;
    const controller = new AbortController();
    setResult(undefined);
    setEnded(false);
    const candidate = warmer.take(Number(id),currentId);
    const warm = !locked ? candidate : undefined;
    (warm ? Promise.resolve(warm.stream) : playback(String(currentId), controller.signal)).then(stream => {
      if (controller.signal.aborted) return;
      if (stream.episode_id !== currentId || String(stream.series_id) !== id) {
        setResult({ id: currentId, error: "unavailable" });
        return;
      }
      setResult({ id: currentId, stream, warm });
    }).catch(reason => {
      if (controller.signal.aborted) return;
      if (reason instanceof SonaError && reason.problem?.reason) setResult({ id: currentId, lock: reason.problem });
      else setResult({ id: currentId, error: reason instanceof SonaError ? reason : "load" });
    });
    return () => controller.abort();
  }, [currentId, id, playAttempt, warmer, locked]);

  const choose = useCallback((value: number, start = 0) => {
    closeSheet();
    const url = new URL(window.location.href);
    url.searchParams.set("episode", String(value));
    url.searchParams.delete("play");
    if (start > 0) url.searchParams.set("at", String(start));
    else url.searchParams.delete("at");
    url.hash = "";
    window.history.replaceState(null, "", url);
    setEnded(false);
    setResult(undefined);
    setPosition(start);
    if (selected === value) setPlayAttempt(n => n + 1);
    else setSelected(value);
  },[selected,closeSheet]);
  const swipe = useReelSwipe(immersive,currentId,previous?.id,next?.id,value => {
    if (immersive) setArriving(value);
    setHint(false);
    choose(value);
  },() => { if (ended) setSwipedAfterEnd(true); });
  const landing = Boolean(immersive && currentId && arriving === currentId && !active?.lock && !active?.error);
  const firstChoiceId = firstChoice?.id;
  useEffect(() => {
    if (autoStart && !selected && firstChoiceId && history !== undefined) choose(firstChoiceId,savedPosition);
  },[autoStart,selected,firstChoiceId,history,savedPosition,choose]);
  const sidebar = <aside className={styles.details} aria-labelledby="series-title">
        {immersive ? <Button className={styles.sheetClose} aria-label={t("Закрыть список серий", "Close episode list")} onClick={closeSheet}><X size={18} /></Button> : !mobile && <InteriorBack href="/catalog" label={t("Каталог", "Catalog")} />}
        <Synopsis title={series?.title ?? summary?.title ?? (error ? t("Сериал недоступен", "Series unavailable") : t("Загружаем сериал…", "Loading series…"))}
          description={(series?.description ?? summary?.description)?.trim()}
          genres={series?.genres.map(genre => genre.name) ?? summary?.genres ?? []} releaseState={series?.releaseState} />
        {(ordered.length > 0 || episodes.busy) && <section className={styles.episodes} aria-labelledby="episodes-title">
          <div className={styles.listHeading}><h2 id="episodes-title">{t("Серии", "Episodes")}</h2><EpisodeCount total={total} current={current?.number} /></div>
          <ol>
            {queue.map(item => <li key={item.id}>
              <Button className={styles.episode} aria-current={current?.id === item.id ? "true" : undefined} onClick={() => {
                if (current?.id !== item.id || !active?.stream) choose(item.id);
                else closeSheet();
              }}>
                <span className={styles.number}>{item.locked ? <LockKeyhole size={16} aria-label={t("Закрыта", "Locked")} /> : <Play size={15} aria-hidden="true" />}</span>
                <strong>{item.title || t(`Серия ${item.number}`, `Episode ${item.number}`)}</strong>
                {item.duration_sec != null && <small>{mediaTime(item.duration_sec)}</small>}
              </Button>
            </li>)}
          </ol>
          {ordered.length > 4 && <Button className={styles.more} aria-expanded={allEpisodes} onClick={() => setAllEpisodes(value => !value)}>
            {allEpisodes ? t("Свернуть", "Show less") : t("Все серии", "All episodes")} <ChevronDown size={15} /></Button>}
          {current && <div className={styles.transport}>
            <Button className={styles.prev} aria-label={t("Предыдущая серия", "Previous episode")} disabled={!previous} onClick={() => previous && choose(previous.id)}><SkipBack size={16} /></Button>
            <Button disabled={!next} aria-label={t("Следующая серия", "Next episode")} onClick={() => next && choose(next.id)}>
              {next?.locked && <LockKeyhole size={13} />} {t("Следующая серия", "Next episode")} <SkipForward size={16} />
            </Button>
          </div>}
          {ended && <span className={styles.ended} role="status">{t("Серия завершена", "Episode complete")}</span>}
        </section>}
        {series && <SeriesSocialActions seriesId={id} />}
      </aside>;

  return <article className={styles.article} data-view="watch" data-immersive={immersive}>
    {mobile && !immersive && <InteriorBack href="/catalog" label={t("Каталог", "Catalog")} />}
    {error && <p role="alert">{error instanceof SonaError ? error.message : t("Не удалось загрузить сериал.", "Could not load this series.")} <Button onClick={() => setAttempt(n => n + 1)}>{t("Повторить", "Retry")}</Button></p>}
    <div className={styles.columns}>
      <div className={styles.theater} role="region" aria-label={t("Плеер", "Video player")}>

        <div ref={swipe.screen} className={styles.screen} data-watch-screen data-arriving={landing}
          onLoadedDataCapture={event => { if (event.target instanceof HTMLMediaElement) setArriving(undefined); }}
          onPlayingCapture={() => setArriving(undefined)}
          data-swipe-episodes={Boolean(current && (previous || next))} {...swipe.gestures}>
          <div className={styles.reelTrack} ref={swipe.track} onTransitionEnd={swipe.finishMotion}>
            {immersive && [previous,next].map((neighbor, side) => neighbor && <div key={neighbor.id}
              aria-hidden="true" inert data-neighbor={side === 0 ? "previous" : "next"} className={styles.neighbor}>
              {poster && <img src={poster} alt="" decoding="async" />}
              <span>{neighbor.locked ? <LockKeyhole size={17} /> : <Play size={16} />} {t(`Серия ${neighbor.number}`, `Episode ${neighbor.number}`)}
                {neighbor.locked && t(" · Закрыта", " · Locked")}</span>
            </div>)}
          {immersive && <div className={styles.mobileNav}>
            <ActionLink href="/catalog" aria-label={t("Вернуться в каталог", "Back to catalog")}><ArrowLeft size={20} /></ActionLink>
            <Button aria-label={t("Серии и описание", "Episodes and series details")} aria-haspopup="dialog" aria-controls="episode-sheet" aria-expanded={sheetOpen} onClick={() => {
              if (!sheet.current || sheet.current.open) return;
              sheet.current.showModal();
              setSheetOpen(true);
              setHint(false);
            }}><ListVideo size={17} /> {t("Серии", "Episodes")}</Button>
          </div>}
          {immersive && hint && (next || previous) && <span className={styles.hint}>{next ? t("Смахните вверх · следующая серия", "Swipe up for the next episode") : t("Смахните вниз · предыдущая серия", "Swipe down for the previous episode")}</span>}
          {(!active?.stream || landing) && poster && <img className={styles.poster} src={poster} alt="" />}
          {active?.stream && <Player key={currentId} stream={active.stream} warmer={warmer} warmed={active.warm} nextToWarm={next?.locked === false ? next.id : undefined} episodeCount={total} position={position} muted={muted} onMute={setMuted} onFinish={() => setEnded(true)} onRestart={() => { setEnded(false); setSwipedAfterEnd(false); }}
            onPrevious={previous ? () => choose(previous.id) : undefined} onNext={next ? () => choose(next.id) : undefined}
            onRetry={lastPosition => choose(active.stream!.episode_id, lastPosition)} />}
          {active?.stream && ended && <EpisodeEndCard key={`end-${currentId}`} next={next} completedSeries={series?.releaseState === "completed"} sheetOpen={immersive && sheetOpen} swiped={swipedAfterEnd}
            onNext={() => { if (next) choose(next.id); }}
            onReplay={() => {
              const video = swipe.screen.current?.querySelector("video");
              if (video) { video.currentTime = 0; void video.play().catch(() => {}); }
            }} />}
          {!active?.stream && <div className={styles.overlay}>
            {active?.lock && current && <AccessWall key={current.id} episode={current.id} number={current.number} problem={active.lock} guest={guest}
              returnPath={localizedPath(`${seriesPath(id, summary?.slug)}?episode=${current.id}&at=${position}`, locale)}
              onUnlocked={() => { episodes.retry(); setPlayAttempt(n => n + 1); }} />}
            {active?.error && <><p role="alert">{active.error instanceof SonaError ? active.error.message : active.error === "unavailable" ? t("Видео этой серии сейчас недоступно.", "Video for this episode is unavailable.") : t("Не удалось загрузить серию.", "Could not load this episode.")}</p><Button onClick={() => setPlayAttempt(n => n + 1)}>{t("Повторить", "Retry")}</Button></>}
            {current && !active && <SonaLoader label={t(`Открываем серию ${current.number}`, `Opening episode ${current.number}`)} />}
            {!current && firstChoice && <>
              {selected > 0 && <p role="status">{t("Выбранная серия недоступна.", "The selected episode is unavailable.")}</p>}
              <Button className={styles.primary} onClick={() => choose(firstChoice.id, savedPosition)}>
                {firstChoice.locked ? <LockKeyhole size={18} /> : <Play size={18} fill="currentColor" />}
                {startLabel}
              </Button>
            </>}
            {!ordered.length && (episodes.busy ? <SonaLoader label={t("Загружаем серии", "Loading episodes")} /> : <><Clapperboard size={32} strokeWidth={1.4} /><p role="status">{episodes.error || t("Серии пока не опубликованы", "No episodes have been released yet")}</p>{episodes.error && <Button onClick={episodes.retry}>{t("Повторить", "Retry")}</Button>}</>)}
          </div>}
          </div>
          <div className={styles.fullNav}>
            {previous && <Button aria-label={t("Предыдущая серия", "Previous episode")} onClick={() => choose(previous.id)}><SkipBack size={18} /></Button>}
            {next && <Button aria-label={t("Следующая серия", "Next episode")} onClick={() => choose(next.id)}><SkipForward size={18} /></Button>}
            {!active?.stream && <Button aria-label={t("Выйти из полного экрана", "Exit fullscreen")} onClick={() => { void document.exitFullscreen().catch(() => {}); }}><Minimize2 size={18} /></Button>}
          </div>
        </div>
      </div>
      {immersive ? <dialog ref={sheet} id="episode-sheet" className={styles.sheet} aria-labelledby="series-title"
        onCancel={event => { event.preventDefault(); closeSheet(); }}
        onClose={() => {
          clearTimeout(sheetExit.current);
          if (sheet.current) delete sheet.current.dataset.closing;
          setSheetOpen(false);
        }}
        onClick={event => { if (event.target === event.currentTarget) closeSheet(); }}>
        <div className={styles.sheetPanel} onTransitionEnd={event => {
          if (event.propertyName === "transform" && event.currentTarget === event.target && sheet.current?.dataset.closing === "true") sheet.current.close();
        }}>{sidebar}</div>
      </dialog> : sidebar}
    </div>
  </article>;
}
