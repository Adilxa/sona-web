"use client";

import { useI18n } from "@/shared/i18n/context";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { useEffect, useRef, useState, type RefObject } from "react";
import { changeContent, SonaError } from "@/shared/api/content";
import { playback } from "@/entities/series";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { FeedActivity, type FeedItem } from "./activity";
import { waitForFeedVisibility } from "./network";
import styles from "./feed.module.css";

export function FeedVideo({ item, activity, position, onPosition, autoplay, onLocked }: {
  item: FeedItem;
  activity: FeedActivity;
  position: number;
  onPosition: (seconds: number) => void;
  autoplay: RefObject<boolean>;
  onLocked: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLVideoElement>(null);
  const resumeAt = useRef(position);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(autoplay.current);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const controller = new AbortController();
    const id = item.series_id;
    const episode = item.first_episode_id;
    let hls: import("hls.js").default | undefined;
    let ready = false;
    let playing = false;
    let started = false;
    let visibleFrom: number | undefined;
    let lastPosition = -1;
    let lastReportAt = 0;
    let pending: number | undefined;
    let saving = false;
    let positionReported = -1;

    async function save() {
      if (saving || !episode) return;
      saving = true;
      try {
        while (pending !== undefined) {
          const position = pending;
          pending = undefined;
          if (position === positionReported) continue;
          await changeContent("progress", "POST", { episode_id: episode, position_sec: position });
          positionReported = position;
        }
      } catch {
        // The next heartbeat picks up the new position after a temporary connection failure.
      } finally {
        saving = false;
      }
    }
    function progress(force: boolean) {
      if (!started || !video) return;
      const position = Math.floor(video.currentTime);
      if (!Number.isFinite(position) || position < 0) return;
      if (position !== lastPosition && !controller.signal.aborted) {
        lastPosition = position;
        resumeAt.current = position;
        onPosition(position);
      }
      if (!episode || position === positionReported || (!force && performance.now() - lastReportAt < 10000)) return;
      lastReportAt = performance.now();
      pending = position;
      void save();
    }
    function attemptPlay() {
      if (started || document.hidden || !ready || !autoplay.current || controller.signal.aborted) return;
      if (hls && !hls.loadingEnabled) hls.startLoad();
      if (video!.paused) {
        void video!.play().catch(() => {
          if (controller.signal.aborted) return;
          if (!started && video!.paused) {
            if (!document.hidden) autoplay.current = false;
            if (hls?.loadingEnabled) hls.stopLoad();
          }
          setLoading(false);
        });
      }
    }
    const metadata = () => {
      if (resumeAt.current > 0 && resumeAt.current < video.duration) video.currentTime = resumeAt.current;
    };
    const observeVisible = () => {
      if (visibleFrom !== undefined && !video.seeking) {
        activity.observePlayback(id, video, visibleFrom, video.currentTime);
        visibleFrom = video.currentTime;
      }
    };
    const countVisible = () => {
      if (document.hidden || !playing || video.paused || video.ended || video.seeking) return;
      visibleFrom ??= video.currentTime;
      activity.play(id);
    };
    const onPlaying = () => {
      if (!started && document.hidden) { video.pause(); return; }
      playing = started = true;
      autoplay.current = true;
      setLoading(false);
      countVisible();
    };
    const onWaiting = () => {
      observeVisible();
      visibleFrom = undefined;
      playing = false;
      if (!video.paused && !document.hidden) setLoading(true);
      activity.pause(id);
    };
    const onPause = () => {
      if (started || !document.hidden) autoplay.current = false;
      observeVisible();
      visibleFrom = undefined;
      playing = false;
      setLoading(false);
      hls?.stopLoad();
      activity.pause(id);
      progress(true);
    };
    const onTime = () => {
      if (document.hidden) return;
      observeVisible();
      progress(false);
    };
    const visibility = () => {
      if (document.hidden) {
        if (!started && ready && hls?.loadingEnabled) hls.stopLoad();
        observeVisible();
        visibleFrom = undefined;
        activity.pause(id);
        progress(true);
      } else {
        countVisible();
        attemptPlay();
      }
    };
    const failure = (reason: unknown) => {
      if (controller.signal.aborted) return;
      if (reason instanceof SonaError && (reason.code === "locked" || reason.code === "registration_required")) {
        onLocked();
        return;
      }
      video.pause();
      hls?.destroy();
      hls = undefined;
      activity.pause(id);
      setLoading(false);
      setError(true);
    };
    const canPlay = () => { setLoading(false); attemptPlay(); };
    const onPlay = () => {
      if (document.hidden && (!started || !autoplay.current)) { video.pause(); return; }
      autoplay.current = true;
      if (hls && !hls.loadingEnabled) hls.startLoad();
    };
    video.addEventListener("loadedmetadata", metadata, { once: true });
    video.addEventListener("playing", onPlaying);
    video.addEventListener("play", onPlay);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("seeking", onWaiting);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onPause);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("error", failure);
    video.addEventListener("canplay", canPlay);
    document.addEventListener("visibilitychange", visibility);
    async function attach() {
      await waitForFeedVisibility(controller.signal);
      if (controller.signal.aborted) return;
      const source = attempt && episode
        ? (await playback(String(episode), controller.signal)).url
        : item.playback_url;
      await waitForFeedVisibility(controller.signal);
      if (controller.signal.aborted) return;
      if (!source || new URL(source).protocol !== "https:") throw Error();
      if (video!.canPlayType("application/vnd.apple.mpegurl")) {
        video!.preload = autoplay.current ? "metadata" : "none";
        video!.src = source;
        ready = true;
        attemptPlay();
        return;
      }
      const { default: Hls } = await import("hls.js");
      await waitForFeedVisibility(controller.signal);
      if (controller.signal.aborted) return;
      if (!Hls.isSupported()) throw Error();
      const engine = new Hls({ autoStartLoad: false, capLevelToPlayerSize: true, backBufferLength: 8,
        maxBufferLength: 10, maxMaxBufferLength: 16 });
      hls = engine;
      engine.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) failure(data); });
      engine.on(Hls.Events.MANIFEST_PARSED, () => { ready = true; setLoading(false); attemptPlay(); });
      engine.loadSource(source);
      engine.attachMedia(video!);
    }
    // A fast swipe over a card should not start its playlist or download the player module.
    const dwell = window.setTimeout(() => void attach().catch(failure), 75);
    const release = () => {
      if (controller.signal.aborted) return;
      window.clearTimeout(dwell);
      progress(true);
      observeVisible();
      controller.abort();
      activity.pause(id);
      video.removeEventListener("loadedmetadata", metadata);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("seeking", onWaiting);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onPause);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("error", failure);
      video.removeEventListener("canplay", canPlay);
      document.removeEventListener("visibilitychange", visibility);
      video.pause();
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted && controller.signal.aborted) setAttempt(value => value + 1);
    };
    window.addEventListener("pagehide", release);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("pagehide", release);
      window.removeEventListener("pageshow", restore);
      release();
    };
  }, [item, activity, attempt, onPosition, autoplay, onLocked]);

  return <>
    <video className={styles.media} ref={ref} muted playsInline controls preload="none"
      aria-label={t(`Первая серия «${item.title}»`, `First episode of “${item.title}”`)} poster={item.poster_url} />
    {loading && !error && <div className={styles.loading}><SonaLoader label={t("Загружаем серию", "Loading episode")} /></div>}
    {error && <div className={styles.videoError} role="status">{t("Не удалось воспроизвести серию.", "Couldn’t play this episode.")}
      <Button onClick={() => { setError(false); setLoading(true); autoplay.current = true; setAttempt(value => value + 1); }}>{t("Повторить", "Try again")}</Button></div>}
  </>;
}
