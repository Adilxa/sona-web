"use client";

import { useI18n } from "@/shared/i18n/context";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { Pin } from "lucide-react";
import { useState } from "react";
import type { CatalogTile, findSeries } from "../api/catalog";
import { setContinuePin } from "../model/continue-pins";
import { ActionLink } from "@/shared/ui/action-link";
import { localizedPath, seriesPath } from "@/shared/seo/urls";
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
  pinned?: boolean;
  termLabel?: string;
};

function timecode(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function SeriesCard({ item, card, guest = false, viewerId, startPlayback = false, variant = "poster", termLabel, pinned }: Props) {
  const { locale, t } = useI18n();
  const [failed, setFailed] = useState<string[]>([]);
  const resume = variant === "continue";
  const cover = [resume ? card?.landscape : undefined, card?.poster, item.poster].find(url => url && !failed.includes(url));
  const count = card?.episodesCount ?? item.episodesCount;
  const title = card?.title || item.title || t(`Сериал №${item.id}`, `Series #${item.id}`);
  const locked = guest && card && card.episodesCount > 0 &&
    (card.freeEpisodesCount === 0 || (item.episodeNumber !== undefined && item.episodeNumber > card.freeEpisodesCount));
  const position = Math.max(0, item.position ?? 0);
  const episodeQuery = item.episode ? new URLSearchParams({ episode: String(item.episode), at: String(item.completed ? 0 : position) }) : null;
  const path = seriesPath(item.id, card?.slug || item.slug);
  const href = localizedPath(path + (episodeQuery ? "?" + episodeQuery : startPlayback ? "?play=1" : ""), locale);
  const action = locked ? t("Открыть серию", "Unlock episode") : item.completed ? t("Смотреть снова", "Watch again") : position > 0 ? t(`Продолжить с ${timecode(position)}`, `Resume at ${timecode(position)}`) : t("Продолжить", "Continue watching");
  const genre = termLabel ?? card?.genres[0]?.name;
  const canPin = resume && viewerId && pinned !== undefined;
  return <div className={canPin ? `${styles.frame} ${styles.pinnable}` : styles.frame}>
    <ActionLink href={href} prefetch={false} className={resume ? styles.resume : styles.card}>
    <span className={styles.art}>
      {cover && <img src={cover} alt="" loading="lazy" decoding="async" onError={() => setFailed(items => [...items, cover])} />}
      {resume ? (count !== undefined || item.episodeNumber !== undefined) && <span className={styles.count}><EpisodeCount total={count} current={item.episodeNumber} /></span> :
        (genre || count !== undefined) && <span className={styles.posterMeta}>
          {genre && <span className={styles.posterGenre}>{genre}</span>}
          {count !== undefined && <EpisodeCount total={count} />}
        </span>}
    </span>
    <span className={styles.copy}>
      {(locked || (card?.isVip ?? item.isVip)) && <span className={styles.access}>{locked ? t("Закрыто", "Locked") : "VIP"}</span>}
      <strong>{title}</strong>
      {resume && genre && <span className={styles.genre}>{genre}</span>}
      {resume && <>
        <span className={styles.resumePlay}>{action}</span>
        {item.duration !== undefined && item.duration > 0 && <progress className={styles.progress} aria-label={t("Прогресс просмотра", "Watch progress")} max={item.duration} value={Math.min(position, item.duration)} />}
      </>}
    </span>
    </ActionLink>
    <div className={styles.actionDock}>
      {canPin ? <Button type="button" className={styles.pin} aria-pressed={pinned}
        aria-label={pinned ? t(`Открепить «${title}»`, `Unpin “${title}”`) : t(`Закрепить «${title}»`, `Pin “${title}”`)}
        title={pinned ? t("Убрать из закреплённых", "Unpin this series") : t("Закрепить в начале списка на этом устройстве", "Pin to the top on this device")}
        onClick={() => setContinuePin(viewerId, item.id, !pinned)}>
        <Pin size={14} aria-hidden="true" />{pinned ? t("Открепить", "Unpin") : t("Закрепить", "Pin")}
      </Button> : <SeriesSaveButton seriesId={item.id} viewerId={viewerId} title={title} compact />}
    </div>
  </div>;
}
