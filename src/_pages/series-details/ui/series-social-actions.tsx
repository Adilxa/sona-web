"use client";

import { useSession } from "@/entities/session";
import { SeriesLikeButton, SeriesSaveButton } from "@/entities/series/ui/series-card-social";
import styles from "./series-social-actions.module.css";

export function SeriesSocialActions({ seriesId }: { seriesId: string | number }) {
  const { me } = useSession();
  return <div className={styles.actions}>
    <SeriesSaveButton seriesId={String(seriesId)} viewerId={me?.id} />
    <SeriesLikeButton seriesId={String(seriesId)} viewerId={me?.id} />
  </div>;
}
