"use client";

import { useEffect, useState } from "react";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { ArrowUpRight } from "lucide-react";
import { useSeriesCardDetails } from "@/entities/series/ui/series-card-details";
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

const collections = {
  continue_watching: { title: "Продолжить просмотр", href: "/history", link: "История" },
  trending: { title: "В тренде", href: "/catalog?sort=popular", link: "Все" },
  new: { title: "Новые сериалы", href: "/catalog?sort=new", link: "Все" },
};

function Shelves({ blocks }: { blocks: HomeBlock[] }) {
  const { me } = useSession();
  const { container, cards } = useSeriesCardDetails<HTMLDivElement>(blocks);
  const [history, setHistory] = useState<Map<number, Progress>>(new Map());
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    if (
      blocks.some(
        (block) => block.kind === "continue_watching" && block.items.some((item) => item.resume_episode_id),
      )
    ) {
      getContent<Schema["ContinueWatching"]>("me/continue-watching", signal)
        .then(({ items }) => {
          if (!signal.aborted) setHistory(new Map(items.map((item) => [item.episode_id, item])));
        })
        .catch(() => {
          /* Home already provides the resume link and position. */
        });
    }

    return () => controller.abort();
  }, [blocks]);

  return (
    <div ref={container} className={styles.shelves}>
      {blocks.map((block) => {
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
                      id: String(item.series_id), title: item.title,
                      episode: item.resume_episode_id ?? item.first_episode_id,
                      episodeNumber: progress?.episode_number, position: progress?.position_sec ?? item.resume_position_sec,
                      duration: progress?.duration_sec, completed: progress?.completed,
                    }}
                    card={cards[item.series_id]} guest={me?.role === "guest"} viewerId={me?.id}
                    variant={block.kind === "continue_watching" ? "continue" : "poster"}
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
            data.blocks.filter((block) => Object.hasOwn(collections, block.kind) && block.items.length > 0),
          );
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Не удалось загрузить подборки.");
      });
    return () => controller.abort();
  }, [version]);
  if (error)
    return (
      <div className={styles.error} role="alert">
        <div>
          <strong>Подборки сейчас недоступны</strong>
          <p>{error}</p>
        </div>
        <Button onClick={() => setVersion((value) => value + 1)}>Обновить подборки</Button>
      </div>
    );
  if (!blocks) return <div className={styles.loading}><SonaLoader label="Загружаем подборки" /></div>;
  return blocks.length ? <Shelves blocks={blocks} /> : null;
}

export function HomeBlocks() {
  const { me } = useSession();
  return me ? <Recommendations key={JSON.stringify([me.id, me.role, me.locale])} /> : null;
}
