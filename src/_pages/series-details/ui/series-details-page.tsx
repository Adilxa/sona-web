"use client";

import { Button } from "@animate-ui/react/primitives/buttons/button";
import { ArrowLeft, ChevronDown, Clapperboard, ListVideo, LockKeyhole, Minimize2, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { findSeries, listEpisodes, playback } from "@/entities/series";
import { EpisodeCount } from "@/entities/series/ui/episode-count";
import { useSession } from "@/entities/session";
import { getContent, SonaError } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { usePage } from "@/shared/lib/use-page";
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
type Props = { id: string; episode: number; at: number; autoStart?: boolean };
type Playing = { id: number; stream?: Schema["Playback"]; warm?: WarmEpisode; lock?: Schema["LockedProblem"]; error?: string };

function subscribeSize(update: () => void) {
  const query = window.matchMedia("(max-width: 760px)");
  query.addEventListener("change",update);
  return () => query.removeEventListener("change",update);
}
const smallScreen = () => window.matchMedia("(max-width: 760px)").matches;

export function SeriesDetailsPage(props: Props) {
  const { me, error, reload } = useSession();
  if (!me) return <div className={styles.article}>{error ? <p role="alert">{error} <Button onClick={reload}>Повторить</Button></p> : <SonaLoader label="Загружаем сериал" />}</div>;
  return <Watch key={JSON.stringify([props.id, props.episode, props.at, props.autoStart, me.id, me.role, me.locale])} {...props} guest={me.role === "guest"} />;
}

function Watch({ id, episode, at, autoStart, guest }: Props & { guest: boolean }) {
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
  const [error, setError] = useState("");
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
  const load = useCallback((cursor: string, signal: AbortSignal) => listEpisodes(id, cursor, signal), [id]);
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
  const total = series?.episodesCount ?? (ordered.length || undefined);
  const description = series?.description ?? "";
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
    setError("");
    findSeries(id, controller.signal).then(card => {
      if (!controller.signal.aborted) setSeries(card);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason.message);
    });
    return () => controller.abort();
  }, [id, attempt]);

  useEffect(() => {
    if (!currentId) return;
    const controller = new AbortController();
    setResult(undefined);
    setEnded(false);
    const candidate = warmer.take(Number(id),currentId);
    const warm = !locked ? candidate : undefined;
    (warm ? Promise.resolve(warm.stream) : playback(String(currentId), controller.signal)).then(stream => {
      if (controller.signal.aborted) return;
      if (stream.episode_id !== currentId || String(stream.series_id) !== id) throw Error("Видео этой серии сейчас недоступно.");
      setResult({ id: currentId, stream, warm });
    }).catch(reason => {
      if (controller.signal.aborted) return;
      if (reason instanceof SonaError && reason.problem?.reason) setResult({ id: currentId, lock: reason.problem });
      else setResult({ id: currentId, error: reason instanceof Error ? reason.message : "Не удалось загрузить серию." });
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
        {immersive ? <Button className={styles.sheetClose} aria-label="Закрыть список серий" onClick={closeSheet}><X size={18} /></Button> : !mobile && <InteriorBack href="/catalog" label="Каталог" />}
        <h1 id="series-title">{series?.title ?? (error ? "Сериал недоступен" : "Загружаем сериал…")}</h1>
        {series && <div className={styles.meta}>{series.genres.map(genre => <span key={genre.id}>{genre.name}</span>)}
          <span>{series.releaseState === "completed" ? "Завершён" : "Выходит"}</span>
        </div>}
        {(ordered.length > 0 || episodes.busy) && <section className={styles.episodes} aria-labelledby="episodes-title">
          <div className={styles.listHeading}><h2 id="episodes-title">Серии</h2><EpisodeCount total={total} current={current?.number} /></div>
          <ol>
            {queue.map(item => <li key={item.id}>
              <Button className={styles.episode} aria-current={current?.id === item.id ? "true" : undefined} onClick={() => {
                if (current?.id !== item.id || !active?.stream) choose(item.id);
                else closeSheet();
              }}>
                <span className={styles.number}>{item.locked ? <LockKeyhole size={16} aria-label="Закрыта" /> : <Play size={15} aria-hidden="true" />}</span>
                <strong>{item.title}</strong>
                {item.duration_sec != null && <small>{mediaTime(item.duration_sec)}</small>}
              </Button>
            </li>)}
          </ol>
          {ordered.length > 4 && <Button className={styles.more} aria-expanded={allEpisodes} onClick={() => setAllEpisodes(value => !value)}>
            {allEpisodes ? "Свернуть" : "Все серии"} <ChevronDown size={15} /></Button>}
          {current && <div className={styles.transport}>
            <Button className={styles.prev} aria-label="Предыдущая серия" disabled={!previous} onClick={() => previous && choose(previous.id)}><SkipBack size={16} /></Button>
            <Button disabled={!next} aria-label="Следующая серия" onClick={() => next && choose(next.id)}>
              {next?.locked && <LockKeyhole size={13} />} Следующая серия <SkipForward size={16} />
            </Button>
          </div>}
          {ended && <span className={styles.ended} role="status">Серия завершена</span>}
        </section>}
        {series && <SeriesSocialActions seriesId={id} />}
        {description && <details className={styles.about}><summary>О сериале <ChevronDown size={15} /></summary><p>{description}</p></details>}
      </aside>;

  return <article className={styles.article} data-view="watch" data-immersive={immersive}>
    {mobile && !immersive && <InteriorBack href="/catalog" label="Каталог" />}
    {error && <p role="alert">{error} <Button onClick={() => setAttempt(n => n + 1)}>Повторить</Button></p>}
    <div className={styles.columns}>
      <div className={styles.theater} role="region" aria-label="Плеер">

        <div ref={swipe.screen} className={styles.screen} data-watch-screen data-arriving={landing}
          onLoadedDataCapture={event => { if (event.target instanceof HTMLMediaElement) setArriving(undefined); }}
          onPlayingCapture={() => setArriving(undefined)}
          data-swipe-episodes={Boolean(current && (previous || next))} {...swipe.gestures}>
          <div className={styles.reelTrack} ref={swipe.track} onTransitionEnd={swipe.finishMotion}>
            {immersive && [previous,next].map((neighbor, side) => neighbor && <div key={neighbor.id}
              aria-hidden="true" inert data-neighbor={side === 0 ? "previous" : "next"} className={styles.neighbor}>
              {series?.poster && <img src={series.poster} alt="" decoding="async" />}
              <span>{neighbor.locked ? <LockKeyhole size={17} /> : <Play size={16} />} Серия {neighbor.number}
                {neighbor.locked && " · Закрыта"}</span>
            </div>)}
          {immersive && <div className={styles.mobileNav}>
            <ActionLink href="/catalog" aria-label="Вернуться в каталог"><ArrowLeft size={20} /></ActionLink>
            <Button aria-label="Серии и описание" aria-haspopup="dialog" aria-controls="episode-sheet" aria-expanded={sheetOpen} onClick={() => {
              if (!sheet.current || sheet.current.open) return;
              sheet.current.showModal();
              setSheetOpen(true);
              setHint(false);
            }}><ListVideo size={17} /> Серии</Button>
          </div>}
          {immersive && hint && (next || previous) && <span className={styles.hint}>{next ? "Смахните вверх · следующая серия" : "Смахните вниз · предыдущая серия"}</span>}
          {(!active?.stream || landing) && series?.poster && <img className={styles.poster} src={series.poster} alt="" />}
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
              returnPath={`/series/${id}?episode=${current.id}&at=${position}`} onUnlocked={() => { episodes.retry(); setPlayAttempt(n => n + 1); }} />}
            {active?.error && <><p role="alert">{active.error}</p><Button onClick={() => setPlayAttempt(n => n + 1)}>Повторить</Button></>}
            {current && !active && <SonaLoader label={`Открываем серию ${current.number}`} />}
            {!current && firstChoice && <>
              {selected > 0 && <p role="status">Выбранная серия недоступна.</p>}
              <Button className={styles.primary} onClick={() => choose(firstChoice.id, savedPosition)}>
                {firstChoice.locked ? <LockKeyhole size={18} /> : <Play size={18} fill="currentColor" />}
                {firstChoice.locked ? `Открыть серию ${firstChoice.number}` : resume ? `Продолжить · серия ${resume.number}${savedPosition ? ` с ${mediaTime(savedPosition)}` : ""}` : "Смотреть с первой серии"}
              </Button>
            </>}
            {!ordered.length && (episodes.busy ? <SonaLoader label="Загружаем серии" /> : <><Clapperboard size={32} strokeWidth={1.4} /><p role="status">{episodes.error || "Серии пока не опубликованы"}</p>{episodes.error && <Button onClick={episodes.retry}>Повторить</Button>}</>)}
          </div>}
          </div>
          <div className={styles.fullNav}>
            {previous && <Button aria-label="Предыдущая серия" onClick={() => choose(previous.id)}><SkipBack size={18} /></Button>}
            {next && <Button aria-label="Следующая серия" onClick={() => choose(next.id)}><SkipForward size={18} /></Button>}
            {!active?.stream && <Button aria-label="Выйти из полного экрана" onClick={() => { void document.exitFullscreen().catch(() => {}); }}><Minimize2 size={18} /></Button>}
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
