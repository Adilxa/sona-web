"use client";

import { Clapperboard, LockKeyhole, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { CatalogTile, findSeries } from "../api/catalog";
import { ActionLink } from "@/shared/ui/action-link";
import { EpisodeCount } from "./episode-count";
import { SeriesSaveButton } from "./series-card-social";
import styles from "./series-card.module.css";

type Props = {
  item: CatalogTile;
  card?: Awaited<ReturnType<typeof findSeries>>;
  guest?: boolean;
  viewerId?: string;
  startPlayback?: boolean;
  variant?: "poster" | "continue";
  termLabel?: string;
};

function timecode(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function SeriesCard({ item, card, guest = false, viewerId, startPlayback = false, variant = "poster", termLabel }: Props) {
  const [failed, setFailed] = useState<string[]>([]);
  const resume = variant === "continue";
  const cover = [resume ? card?.landscape : undefined, card?.poster, item.poster].find(url => url && !failed.includes(url));
  const count = card?.episodesCount ?? item.episodesCount;
  const title = card?.title || item.title || `Сериал №${item.id}`;
  const locked = guest && card && card.episodesCount > 0 &&
    (card.freeEpisodesCount === 0 || (item.episodeNumber !== undefined && item.episodeNumber > card.freeEpisodesCount));
  const position = Math.max(0, item.position ?? 0);
  const episodeQuery = item.episode ? new URLSearchParams({ episode: String(item.episode), at: String(item.completed ? 0 : position) }) : null;
  const href = "/series/" + encodeURIComponent(item.id) + (episodeQuery ? "?" + episodeQuery : startPlayback ? "?play=1" : "");
  const Icon = locked ? LockKeyhole : item.completed ? RotateCcw : Play;
  const action = locked ? "Открыть серию" : item.completed ? "Смотреть снова" : position > 0 ? `Продолжить с ${timecode(position)}` : "Продолжить";
  const genre = termLabel ?? card?.genres[0]?.name;
  return <div className={styles.frame}>
    <ActionLink href={href} prefetch={false} className={resume ? styles.resume : styles.card}>
    <span className={styles.art}>
      {cover ? <img src={cover} alt="" loading="lazy" decoding="async" onError={() => setFailed(items => [...items, cover])} />
        : <Clapperboard className={styles.missingArt} size={36} strokeWidth={1.2} aria-hidden="true" />}
      {!resume && <span className={styles.play} aria-hidden="true"><Icon size={18} fill={!locked && !item.completed ? "currentColor" : "none"} /></span>}
      {(count !== undefined || (resume && item.episodeNumber)) && <span className={styles.count}><EpisodeCount total={count} current={resume ? item.episodeNumber : undefined} /></span>}
    </span>
    <span className={styles.copy}>
      {(locked || (card?.isVip ?? item.isVip)) && <span className={styles.access}>{locked ? <><LockKeyhole size={12} aria-hidden="true" />Закрыто</> : "VIP"}</span>}
      <strong>{title}</strong>
      {genre && <span className={styles.genre}>{genre}</span>}
      {resume && <>
        <span className={styles.resumePlay}><Icon size={15} fill={!locked && !item.completed ? "currentColor" : "none"} aria-hidden="true" />{action}</span>
        {item.duration !== undefined && item.duration > 0 && <progress className={styles.progress} aria-label="Прогресс просмотра" max={item.duration} value={Math.min(position, item.duration)} />}
      </>}
    </span>
    </ActionLink>
    <div className={styles.saveDock}><SeriesSaveButton seriesId={item.id} viewerId={viewerId} title={title} compact /></div>
  </div>;
}
