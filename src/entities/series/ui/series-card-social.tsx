"use client";

import { useI18n } from "@/shared/i18n/context";
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
  const { t } = useI18n();
  const { write, pending, failed, error } = useSeriesSocialWrite(kind, viewerId, seriesId);
  const save = kind === "favorite";
  const failure = readError || (failed ? error || t("Не удалось сохранить изменение.", "Couldn’t save this change.") : undefined);
  const working = pending || reading;
  const subject = title ? t(` «${title}»`, ` “${title}”`) : "";
  const action = save
    ? value ? t(`Убрать${subject} из избранного`, `Remove${subject} from favorites`) : t(`Добавить${subject} в избранное`, `Add${subject} to favorites`)
    : value ? t("Убрать отметку «Нравится»", "Unlike this series") : t("Поставить отметку «Нравится»", "Like this series");
  const text = failure ? t("Повторить", "Try again") : save ? value ? t("В избранном", "Saved") : t("В избранное", "Save") : value ? t("Понравилось", "Liked") : t("Нравится", "Like");
  const Icon = failure ? RotateCw : save ? value && !compact ? BookmarkCheck : Bookmark : Heart;
  const readingCompact = Boolean(compact && reading && viewerId);
  const label = pending ? t("Сохраняем изменение", "Saving changes") : readingCompact ? t("Загружаем избранное", "Loading favorites") :
    readError ? t("Повторить загрузку избранного", "Retry loading favorites") : failed ? t(`Повторить: ${action}`, `Retry: ${action}`) : action;
  return <span className={styles.wrap} data-compact={compact || undefined}>
    <Button type="button" className={compact ? styles.compactButton : styles.button} disabled={!viewerId || working} aria-label={label} title={label}
      aria-pressed={value} aria-busy={working || undefined} data-failed={Boolean(failure) || undefined}
      onClick={() => { if (readError) refetch?.(); else write(!value); }}>
      {pending || readingCompact ? <SonaLoader label={pending ? t("Сохраняем…", "Saving…") : t("Загружаем…", "Loading…")} /> :
        <><Icon size={compact ? 20 : 17} fill={value && !failure && (compact || !save) ? "currentColor" : "none"} aria-hidden="true" />{!compact && text}</>}
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
