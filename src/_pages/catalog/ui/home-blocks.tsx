"use client";

import { useI18n } from "@/shared/i18n/context";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { ArrowUpRight } from "lucide-react";
import { useSeriesCardDetails } from "@/entities/series/ui/series-card-details";
import { pinnedFirst, useContinuePins } from "@/entities/series/model/continue-pins";
import { useSession } from "@/entities/session";
import { SeriesCard } from "@/entities/series/ui/series-card";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { getContent } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { ActionLink } from "@/shared/ui/action-link";
import styles from "./home-blocks.module.css";

type Schema = components["schemas"];
type HomeBlock = Schema["HomeBlock"];
type Progress = Schema["ContinueWatchingItem"];
type ShelfItem = Omit<Schema["HomeItem"], "slug"> & { slug?: string };
type Shelf = { kind: HomeBlock["kind"]; items: ShelfItem[] };

function Shelves({ blocks }: { blocks: HomeBlock[] }) {
  const { t } = useI18n();
  const collections = {
    continue_watching: { title: t("Продолжить просмотр", "Continue watching"), href: "/history", link: t("История", "History") },
    trending: { title: t("В тренде", "Trending"), href: "/catalog?sort=popular", link: t("Все", "View all") },
    new: { title: t("Новые сериалы", "New series"), href: "/catalog?sort=new", link: t("Все", "View all") },
  };

  const { me } = useSession();
  const pins = useContinuePins(me?.id);
  const [history, setHistory] = useState<Map<number, Progress>>(new Map());
  const needsHistory = pins.size > 0 || blocks.some(block =>
    block.kind === "continue_watching" && block.items.some(item => item.resume_episode_id));
  useEffect(() => {
    if (!needsHistory) return;
    const controller = new AbortController();
    const { signal } = controller;
    getContent<Schema["ContinueWatching"]>("me/continue-watching", signal)
      .then(({ items }) => {
        if (!signal.aborted) setHistory(new Map(items.map((item) => [item.episode_id, item])));
      })
      .catch(() => {
        /* Home already provides the resume link and position. */
      });
    return () => controller.abort();
  }, [needsHistory]);

  const shelves = useMemo<Shelf[]>(() => {
    if (!pins.size) return blocks;
    const resume = blocks.find(block => block.kind === "continue_watching");
    const items: ShelfItem[] = [...(resume?.items ?? [])];
    const listed = new Set(items.map(item => item.series_id));
    // The home feed can be shorter than history. Promote only pins that still have real progress.
    for (const row of history.values()) {
      if (pins.has(String(row.series_id)) && !listed.has(row.series_id)) {
        listed.add(row.series_id);
        items.push({ series_id: row.series_id, title: "", resume_episode_id: row.episode_id, resume_position_sec: row.position_sec });
      }
    }
    if (!items.length) return blocks;
    const shelf: Shelf = { kind: "continue_watching", items: pinnedFirst(items, pins, item => String(item.series_id)) };
    return resume ? blocks.map(block => block === resume ? shelf : block) : [shelf, ...blocks];
  }, [blocks, history, pins]);
  const { container, cards } = useSeriesCardDetails<HTMLDivElement>(shelves);

  if (!shelves.length) return null;
  return (
    <div ref={container} className={styles.shelves}>
      {shelves.map((block) => {
        const section = collections[block.kind];
        return (
          <section key={block.kind} aria-labelledby={`home-${block.kind}`}>
            <div className={styles.heading}>
              <h2 id={`home-${block.kind}`}>{section.title}</h2>
              <ActionLink className={styles.more} href={section.href}>
                {section.link}
                <ArrowUpRight size={17} aria-hidden="true" />
              </ActionLink>
            </div>
            <ul className={block.kind === "continue_watching" ? styles.continueRail : styles.rail}>
              {block.items.map((item) => {
                const saved = item.resume_episode_id ? history.get(item.resume_episode_id) : undefined;
                const progress = saved?.series_id === item.series_id ? saved : undefined;
                return <li key={item.series_id} data-series={item.series_id}>
                  <SeriesCard
                    item={{
                      id: String(item.series_id), slug: item.slug, title: item.title,
                      episode: item.resume_episode_id ?? item.first_episode_id,
                      episodeNumber: progress?.episode_number, position: progress?.position_sec ?? item.resume_position_sec,
                      duration: progress?.duration_sec, completed: progress?.completed,
                    }}
                    card={cards[item.series_id]} guest={me?.role === "guest"} viewerId={me?.id}
                    variant={block.kind === "continue_watching" ? "continue" : "poster"}
                    pinned={block.kind === "continue_watching" ? pins.has(String(item.series_id)) : undefined}
                  />
                </li>;
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Recommendations() {
  const { t } = useI18n();
  const [blocks, setBlocks] = useState<HomeBlock[]>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getContent<Schema["HomePage"]>("home", controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setBlocks(
            data.blocks.filter((block) => ["continue_watching", "trending", "new"].includes(block.kind) && block.items.length > 0),
          );
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : t("Не удалось загрузить подборки.", "Couldn’t load the collections."));
      });
    return () => controller.abort();
  }, [version, t]);
  if (error)
    return (
      <div className={styles.error} role="alert">
        <div>
          <strong>{t("Подборки сейчас недоступны", "Collections are unavailable")}</strong>
          <p>{error}</p>
        </div>
        <Button onClick={() => setVersion((value) => value + 1)}>{t("Обновить подборки", "Reload collections")}</Button>
      </div>
    );
  if (!blocks) return <div className={styles.loading}><SonaLoader label={t("Загружаем подборки", "Loading collections")} /></div>;
  return <Shelves blocks={blocks} />;
}

export function HomeBlocks() {
  const { locale } = useI18n();
  const { me } = useSession();
  return me ? <Recommendations key={JSON.stringify([me.id, me.role, locale])} /> : null;
}
