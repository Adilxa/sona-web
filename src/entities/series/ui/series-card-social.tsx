"use client";

import { Button } from "@animate-ui/react/primitives/buttons/button";
import { Bookmark, BookmarkCheck, Heart, RotateCw } from "lucide-react";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { useConfirmedLike, useSeriesFavorites, useSeriesSocialWrite } from "../model/social";
import styles from "./series-card-social.module.css";

type Props = { seriesId: string; viewerId?: string; title?: string; compact?: boolean };

function SocialButton({ kind, value, reading, readError, refetch, seriesId, viewerId, title, compact }: Props & {
  kind: "like" | "favorite";
  value?: boolean;
  reading?: boolean;
  readError?: string;
  refetch?: () => void;
}) {
  const { write, pending, failed, error } = useSeriesSocialWrite(kind, viewerId, seriesId);
  const save = kind === "favorite";
  const failure = readError || (failed ? error || "Не удалось сохранить изменение." : undefined);
  const working = pending || reading;
  const subject = title ? ` «${title}»` : "";
  const action = save
    ? value ? `Убрать${subject} из избранного` : `Добавить${subject} в избранное`
    : value ? "Убрать отметку «Нравится»" : "Поставить отметку «Нравится»";
  const text = failure ? "Повторить" : save ? value ? "В избранном" : "В избранное" : value ? "Понравилось" : "Нравится";
  const Icon = failure ? RotateCw : save ? value ? BookmarkCheck : Bookmark : Heart;
  const label = pending ? "Сохраняем изменение" : readError ? "Повторить загрузку избранного" : failed ? `Повторить: ${action}` : action;
  return <span className={styles.wrap} data-compact={compact || undefined}>
    <Button type="button" className={styles.button} disabled={!viewerId || working} aria-label={label} title={label}
      aria-pressed={value} aria-busy={working || undefined} data-failed={Boolean(failure) || undefined}
      onClick={() => { if (readError) refetch?.(); else write(!value); }}>
      {pending ? <SonaLoader label="Сохраняем…" /> : <><Icon size={compact ? 19 : 17} fill={!save && value && !failure ? "currentColor" : "none"} aria-hidden="true" />{!compact && text}</>}
    </Button>
    {failure && (!compact || !readError) && <span role="alert" className={styles.error}>{failure}</span>}
  </span>;
}

export function SeriesSaveButton(props: Props) {
  const favorites = useSeriesFavorites(props.viewerId);
  return <SocialButton {...props} kind="favorite" value={favorites.data?.includes(props.seriesId)}
    reading={favorites.isPending && !favorites.isError}
    readError={favorites.isError && !favorites.data ? favorites.error.message : undefined}
    refetch={() => { void favorites.refetch(); }} />;
}

export function SeriesLikeButton(props: Props) {
  const value = useConfirmedLike(props.viewerId, props.seriesId);
  return <SocialButton {...props} kind="like" value={value} />;
}
