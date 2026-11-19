"use client";

import { useI18n } from "@/shared/i18n/context";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { changeContent } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { PlayerControls } from "./player-controls";
import { fastConnection, NextEpisodeBuffer, reuseOpening, shouldWarm, type NetworkInfo, type WarmEpisode } from "./next-episode";
import styles from "./details.module.css";

type Schema = components["schemas"];

type TabPlayback = {
  connect: () => void;
  suspendLoading: () => void;
  resumeLoading: () => void;
  playing: () => void;
  checkpoint: () => void;
  leave: () => void;
};

export function bindPlaybackTab(element: HTMLVideoElement, actions: TabPlayback) {
  let started = false;
  let leftPage = false;
  let heldInitialLoad = false;
  let heldInitialPlay = false;
  let userPaused = false;
  let mayRecover = false;
  let recovery: number | undefined;

  const holdFirstStart = () => {
    if (started || userPaused) return;
    heldInitialLoad = true;
    actions.suspendLoading();
    if (!element.paused) {
      heldInitialPlay = true;
      element.pause();
    }
  };
  const playing = () => {
    if (leftPage) { if (!element.paused) element.pause(); return; }
    if (!started && document.hidden) { userPaused = false; holdFirstStart(); return; }
    started = true;
    userPaused = false;
    actions.playing();
  };
  const paused = () => {
    // A media pause has no reliable source (OS, headset or viewer). Respect all three.
    mayRecover = false;
    if (!heldInitialPlay) userPaused = true;
    actions.checkpoint();
  };
  const remember = () => {
    if (started && !userPaused && !element.paused && !element.ended) mayRecover = true;
  };
  const visibility = () => {
    window.clearTimeout(recovery);
    if (leftPage) return;
    if (document.hidden) {
      remember();
      holdFirstStart();
      actions.checkpoint();
      return;
    }
    actions.connect();
    if (heldInitialLoad && !userPaused) actions.resumeLoading();
    heldInitialLoad = false;
    // Allow any queued media-key/pause event to win before restoring a silently suspended video.
    recovery = window.setTimeout(() => {
      const shouldPlay = (mayRecover || heldInitialPlay) && !userPaused && !element.ended && !element.error;
      if (leftPage || document.hidden) return;
      mayRecover = false;
      heldInitialPlay = false;
      if (shouldPlay && element.paused) void element.play().catch(() => {});
    },0);
  };
  const leave = () => {
    leftPage = true;
    mayRecover = heldInitialPlay = heldInitialLoad = false;
    window.clearTimeout(recovery);
    actions.leave();
    if (!element.paused) element.pause();
    actions.suspendLoading();
  };
  const showPage = () => { leftPage = false; visibility(); };

  element.addEventListener("playing",playing);
  element.addEventListener("pause",paused);
  document.addEventListener("visibilitychange",visibility);
  document.addEventListener("freeze",remember);
  window.addEventListener("pagehide",leave);
  window.addEventListener("pageshow",showPage);
  if (!document.hidden) actions.connect();

  return () => {
    window.clearTimeout(recovery);
    element.removeEventListener("playing",playing);
    element.removeEventListener("pause",paused);
    document.removeEventListener("visibilitychange",visibility);
    document.removeEventListener("freeze",remember);
    window.removeEventListener("pagehide",leave);
    window.removeEventListener("pageshow",showPage);
  };
}

export function Player({ stream, episodeCount, warmer, warmed, nextToWarm, position, muted, onMute, onFinish, onRestart, onRetry, onPrevious, onNext }: {
  stream: Schema["Playback"];
  warmer: NextEpisodeBuffer;
  warmed?: WarmEpisode;
  nextToWarm?: number;
  episodeCount?: number;
  position: number;
  muted: boolean;
  onMute: (value: boolean) => void;
  onFinish: () => void;
  onRestart: () => void;
  onRetry: (position: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const usingHlsJs = useRef(false);
  const [error, setError] = useState(false);
  const [progressError, setProgressError] = useState(false);
  const finish = useEffectEvent(onFinish);
  const restart = useEffectEvent(onRestart);

  useEffect(() => {
    const element = video.current!;
    const network = (navigator as Navigator & { connection?: NetworkInfo & EventTarget }).connection;
    if (!nextToWarm || !network) return;
    const preference = window.matchMedia("(prefers-reduced-data: reduce)");
    let playing = false;
    const check = () => {
      if (playing && usingHlsJs.current && !preference.matches && shouldWarm(network,!document.hidden,element)) {
        void warmer.prepare(stream.series_id,nextToWarm);
      } else warmer.cancelPending();
    };
    const started = () => { playing = true; check(); };
    const stopped = () => { playing = false; warmer.cancelPending(); };
    const events = { playing: started, timeupdate: check, progress: check, waiting: stopped, pause: stopped, seeking: stopped, ended: stopped };
    Object.entries(events).forEach(([name, handler]) => element.addEventListener(name,handler));
    document.addEventListener("visibilitychange",check);
    network.addEventListener("change",check);
    preference.addEventListener("change",check);
    window.addEventListener("pagehide",stopped);
    return () => {
      Object.entries(events).forEach(([name, handler]) => element.removeEventListener(name,handler));
      document.removeEventListener("visibilitychange",check);
      network.removeEventListener("change",check);
      preference.removeEventListener("change",check);
      window.removeEventListener("pagehide",stopped);
      warmer.cancelPending();
    };
  },[nextToWarm,stream.series_id,warmer]);

  useEffect(() => {
    const element = video.current!;
    let closed = false;
    let attached = false;
    let disposeStream: (() => void) | undefined;
    let suspendStream: (() => void) | undefined;
    let resumeInitialStream: (() => void) | undefined;
    let started = false;
    let completed = false;
    let lastQueued = -1;
    let lastWatchSeconds = 0;
    let writes = Promise.resolve();
    const queue: Schema["EventInput"][] = [];
    const event = (type: Schema["EventInput"]["type"], value?: number) => queue.push({
      type, value, series_id: stream.series_id, episode_id: stream.episode_id,
      event_id: crypto.randomUUID(), occurred_at: new Date().toISOString(),
    });

    function report(lastChance = false) {
      if (!started) return;
      const current = Math.floor(element.currentTime);
      if (!Number.isFinite(current) || current < 0) return;
      let watched = 0;
      for (let i = 0; i < element.played.length; i++) watched += element.played.end(i) - element.played.start(i);
      const seconds = Math.floor(watched);
      if (seconds > lastWatchSeconds) {
        event("watch_time", Math.min(86400, seconds - lastWatchSeconds));
        lastWatchSeconds = seconds;
      }
      if (!completed && Number.isFinite(element.duration) && element.duration > 0 && watched >= element.duration * .9) {
        completed = true;
        event("complete");
      }
      const payload: Schema["ProgressReport"] = { episode_id: stream.episode_id, position_sec: current };
      const events = queue.splice(0);
      if (lastChance) {
        // pagehide can run after the last normal heartbeat has been queued but before it has reached the server.
        const send = (path: string, body: object) => {
          void fetch(`/api/content/${path}`, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
        };
        send("progress", payload);
        if (events.length) send("events", { events });
        lastQueued = current;
        return;
      }
      const writePosition = current !== lastQueued;
      if (!writePosition && !events.length) return;
      lastQueued = current;
      writes = writes.then(async () => {
        if (writePosition) {
          try {
            await changeContent("progress", "POST", payload);
            if (!closed) setProgressError(false);
          } catch {
            if (lastQueued === current) lastQueued = -1;
            if (!closed) setProgressError(true);
          }
        }
        if (events.length) await changeContent("events", "POST", { events } satisfies Schema["EventBatch"]).catch(() => {});
      });
    }
    const playing = () => {
      if (!started) event("play_start");
      started = true;
      restart();
    };
    const end = () => { report(); finish(); };
    const metadata = () => {
      if (position > 0 && Number.isFinite(element.duration) && position < element.duration) element.currentTime = position;
    };
    const failure = () => { if (!closed) setError(true); };
    element.addEventListener("loadedmetadata", metadata, { once: true });
    element.addEventListener("ended", end);
    element.addEventListener("error", failure);
    const interval = window.setInterval(() => { if (!element.paused) report(); }, 10_000);
    async function attach() {
      const native = element.canPlayType("application/vnd.apple.mpegurl");
      const network = (navigator as Navigator & { connection?: NetworkInfo }).connection;
      if (native && (!fastConnection(network) || !window.MediaSource)) {
        element.src = stream.url;
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (closed) return;
      if (document.hidden || pageUnloaded) { attached = false; return; }
      if (!Hls.isSupported()) {
        if (!native) throw Error();
        element.src = stream.url;
        return;
      }
      const hls = new Hls({ capLevelToPlayerSize: true, maxBufferLength: 12, maxMaxBufferLength: 24, backBufferLength: 8,
        ...(warmed?.resources.size && { loader: reuseOpening(Hls.DefaultConfig.loader,warmed), startLevel: 0, testBandwidth: false }) });
      usingHlsJs.current = true;
      let suspended = false;
      const stop = () => {
        if (!suspended) { suspended = true; hls.stopLoad(); }
      };
      const resume = () => {
        if (suspended) { suspended = false; hls.startLoad(-1); }
      };
      element.addEventListener("pause", stop);
      element.addEventListener("play", resume);
      suspendStream = stop;
      resumeInitialStream = resume;
      disposeStream = () => {
        usingHlsJs.current = false;
        element.removeEventListener("pause", stop);
        element.removeEventListener("play", resume);
        hls.destroy();
      };
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) failure(); });
      hls.loadSource(stream.url);
      hls.attachMedia(element);
    }
    function startVisible() {
      if (!attached && !document.hidden) {
        attached = true;
        void attach().catch(failure);
      }
    }
    let pageUnloaded = false;
    const disconnectTab = bindPlaybackTab(element, {
      connect() { pageUnloaded = false; startVisible(); },
      suspendLoading() { suspendStream?.(); },
      resumeLoading() { resumeInitialStream?.(); },
      playing, checkpoint: report,
      leave() { pageUnloaded = true; report(true); },
    });
    return () => {
      closed = true;
      disconnectTab();
      window.clearInterval(interval);
      element.removeEventListener("loadedmetadata", metadata);
      element.removeEventListener("ended", end);
      element.removeEventListener("error", failure);
      report();
      disposeStream?.();
      element.removeAttribute("src");
      element.load();
    };
  }, [stream, position, warmed]);

  return <div className={styles.cinema}>
    <video ref={video} autoPlay playsInline muted={muted} onVolumeChange={event => onMute(event.currentTarget.muted)} preload="metadata" poster={stream.poster_url} aria-label={t(`Серия ${stream.number}`, `Episode ${stream.number}`)}
      crossOrigin={stream.subtitles?.length ? "anonymous" : undefined}>
      {stream.subtitles?.filter(track => track.url.startsWith("https://")).map(track =>
        <track key={track.lang} kind="subtitles" src={track.url} srcLang={track.lang} label={track.lang.toUpperCase()} />)}
    </video>
    {!error && <PlayerControls video={video} durationHint={stream.duration_sec} episodeNumber={stream.number} episodeCount={episodeCount} onPrevious={onPrevious} onNext={onNext} />}
    {error && <div role="alert" className={styles.overlay}><p>{t("Не удалось загрузить видео.", "The video could not be loaded.")}</p><Button onClick={() => onRetry(Math.floor(video.current?.currentTime || position))}>{t("Загрузить видео ещё раз", "Retry video")}</Button></div>}
    {progressError && !error && <small role="status" className={styles.progressError}>{t("Не удалось сохранить позицию", "Could not save your progress")}</small>}
  </div>;
}
