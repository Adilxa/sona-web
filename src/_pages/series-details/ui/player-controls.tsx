"use client";

import { Button } from "@animate-ui/react/primitives/buttons/button";
import { Captions, Maximize2, Minimize2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { EpisodeCount } from "@/entities/series/ui/episode-count";
import { mediaTime } from "./player-gesture";
import styles from "./details.module.css";

type Props = {
  video: RefObject<HTMLVideoElement | null>;
  durationHint: number;
  episodeNumber: number;
  episodeCount?: number;
  onPrevious?: () => void;
  onNext?: () => void;
};

export function PlayerControls({ video, durationHint, episodeNumber, episodeCount, onPrevious, onNext }: Props) {
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(durationHint);
  const [ended, setEnded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [tracks, setTracks] = useState<TextTrack[]>([]);
  const [captionIndex, setCaptionIndex] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);


  const reveal = useCallback(() => {
    setVisible(true);
    clearTimeout(timer.current);
    const el = video.current;
    if (el && !el.paused && !el.ended) timer.current = setTimeout(() => setVisible(false), 2600);
  }, [video]);

  useEffect(() => {
    const el = video.current!;
    const screen = el.closest<HTMLElement>("[data-watch-screen]");
    const updateTime = () => {
      setElapsed(Math.floor(el.currentTime || 0));
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    };
    const onPlaying = () => { setPlaying(true); setEnded(false); setWaiting(false); reveal(); };
    const onPause = () => { setPlaying(false); setWaiting(false); reveal(); };
    const onEnd = () => { onPause(); setEnded(true); };
    const onWaiting = () => { if (!el.paused) setWaiting(true); };
    const onReady = () => { setWaiting(false); updateTime(); };
    const onMetadata = () => {
      updateTime();
      if (el.paused) setWaiting(false);
    };
    const volume = () => setMuted(el.muted || el.volume === 0);
    const resize = () => setFullscreen(Boolean(screen && document.fullscreenElement === screen));
    const readTracks = () => {
      const subtitles = Array.from(el.textTracks ?? []).filter(track => track.kind === "subtitles" || track.kind === "captions");
      setTracks(subtitles);
      setCaptionIndex(subtitles.findIndex(track => track.mode === "showing"));
    };
    const handlers: Record<string, () => void> = {
      loadedmetadata: onMetadata, durationchange: updateTime, timeupdate: updateTime, canplay: onReady,
      loadeddata: onReady, waiting: onWaiting, seeking: onWaiting, seeked: onReady,
      playing: onPlaying, pause: onPause, ended: onEnd, volumechange: volume,
    };
    Object.entries(handlers).forEach(([event, handler]) => el.addEventListener(event, handler));
    document.addEventListener("fullscreenchange", resize);
    el.textTracks?.addEventListener?.("addtrack", readTracks);
    el.textTracks?.addEventListener?.("removetrack", readTracks);
    el.textTracks?.addEventListener?.("change", readTracks);
    setCanExpand(Boolean((document.fullscreenEnabled && screen?.requestFullscreen) || "webkitEnterFullscreen" in el));
    resize();
    readTracks();
    volume();
    return () => {
      clearTimeout(timer.current);
      Object.entries(handlers).forEach(([event, handler]) => el.removeEventListener(event, handler));
      document.removeEventListener("fullscreenchange", resize);
      el.textTracks?.removeEventListener?.("addtrack", readTracks);
      el.textTracks?.removeEventListener?.("removetrack", readTracks);
      el.textTracks?.removeEventListener?.("change", readTracks);
    };
  }, [video, reveal]);

  function togglePlay() {
    const el = video.current;
    if (!el) return;
    reveal();
    if (el.paused || el.ended) {
      if (el.ended) el.currentTime = 0;
      void el.play().catch(() => { setWaiting(false); setVisible(true); });
    } else el.pause();
  }
  async function expand() {
    const el = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!el) return;
    const screen = el.closest<HTMLElement>("[data-watch-screen]");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled && screen?.requestFullscreen) await screen.requestFullscreen();
      else el.webkitEnterFullscreen?.();
    } catch { reveal(); }
  }
  function toggleMute() {
    const el = video.current;
    if (el) { el.muted = !muted; if (muted && el.volume === 0) el.volume = 1; }
    reveal();
  }
  const playLabel = ended ? "Смотреть ещё раз" : playing ? "Пауза" : "Воспроизвести";
  const played = duration > 0 ? Math.min(100, elapsed / duration * 100) : 0;

  return <div className={styles.controls} role="group" aria-label="Управление воспроизведением" tabIndex={0}
    onKeyDown={event => {
      const target = event.target as HTMLElement;
      const el = video.current;
      if (!el || event.altKey || event.ctrlKey || event.metaKey || target.closest("select,input")) return;
      const key = event.key.toLowerCase();
      if (key === "k" || (key === " " && !target.closest("button"))) togglePlay();
      else if (key === "m") toggleMute();
      else if (key === "f" && canExpand) void expand();
      else if ((key === "arrowleft" || key === "arrowright") && Number.isFinite(el.duration)) {
        el.currentTime = Math.max(0,Math.min(el.duration,el.currentTime + (key === "arrowleft" ? -5 : 5)));
        reveal();
      } else return;
      event.preventDefault();
    }} data-visible={visible || !playing || waiting} onPointerMove={event => { if (event.pointerType === "mouse") reveal(); }} onFocus={reveal}>
    <button type="button" className={styles.hit} data-swipe={Boolean(onPrevious || onNext)} tabIndex={-1} aria-label={playLabel} onClick={togglePlay} />
    <span className={styles.episodeBadge}><EpisodeCount current={episodeNumber} total={episodeCount} /></span>
    {waiting && <div className={styles.buffer}><SonaLoader label="Загружаем видео" /></div>}
    {!playing && !waiting && <span className={styles.centerPlay} aria-hidden="true">{ended ? <RotateCcw /> : <Play fill="currentColor" />}</span>}
    <div className={styles.deck}>
      <div className={styles.tools}>
        <Button className={styles.tool} aria-label={playLabel} title={playLabel + " (K)"} onClick={togglePlay}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</Button>
        <span className={styles.clock}>{mediaTime(elapsed)} <span>/ {mediaTime(duration)}</span></span>
        <div className={styles.trailingTools}>
          {tracks.length > 0 && <label className={styles.trackPicker}><Captions size={20} aria-hidden="true" />
            <select aria-label="Субтитры" value={captionIndex} onChange={event => {
              const selected = Number(event.target.value);
              tracks.forEach((track, i) => { track.mode = i === selected ? "showing" : "disabled"; });
              setCaptionIndex(selected);
            }}><option value={-1}>Без субтитров</option>{tracks.map((track, i) => <option value={i} key={i}>{track.label || track.language || `Дорожка ${i + 1}`}</option>)}</select>
          </label>}
          <Button className={styles.tool} aria-label={muted ? "Включить звук" : "Выключить звук"} title="Звук (M)" onClick={toggleMute}>{muted ? <VolumeX /> : <Volume2 />}</Button>
          {canExpand && <Button className={styles.tool} aria-label={fullscreen ? "Выйти из полного экрана" : "На весь экран"} title="Полный экран (F)" onClick={expand}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</Button>}
        </div>
      </div>
      <input type="range" className={styles.seek} aria-label="Позиция в серии" min={0} max={duration > 0 ? duration : 0} step={1} value={Math.min(elapsed, Math.max(duration, 0))}
        aria-valuetext={`${mediaTime(elapsed)} из ${mediaTime(duration)}`} disabled={duration <= 0} style={{ "--played": `${played}%` } as CSSProperties}
        onChange={event => {
          const el = video.current;
          const value = Number(event.target.value);
          if (el && Number.isFinite(el.duration)) { el.currentTime = value; setElapsed(Math.floor(value)); }
          reveal();
        }} />
    </div>
  </div>;
}
