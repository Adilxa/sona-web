"use client";

import { useI18n } from "@/shared/i18n/context";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import Link from "next/link";
import * as ToggleGroup from "@animate-ui/react/primitives/radix-ui/toggle-group";
import { useEffect, useRef, useState } from "react";
import { findSeries, loadCollection } from "@/entities/series";
import { SeriesCard } from "@/entities/series/ui/series-card";
import { useSession } from "@/entities/session";
import { useViewingMood } from "@/features/viewing-mood/context";
import { isViewingMood, matchingMoodTerm, moodOptions, moodCopy } from "@/features/viewing-mood/model";
import { SonaError } from "@/shared/api/content";
import { SonaLoader } from "@/shared/ui/sona-loader";
import styles from "./mood-shelf.module.css";

type Card = Awaited<ReturnType<typeof findSeries>>;
type Candidates = { ids: string[]; cursor: string };

async function loadCandidates(request: Candidates, signal: AbortSignal) {
  let { ids, cursor } = request;
  if (!ids.length) {
    const page = await loadCollection("catalog", "", cursor, signal, { sort: "popular", summariesOnly: true });
    ids = page.items.map(item => item.id);
    cursor = page.next;
  }
  const batch = ids.slice(0, 6);
  const cards: Card[] = [];
  for (let i = 0; i < batch.length; i += 3) {
    signal.throwIfAborted();
    const group = await Promise.all(batch.slice(i, i + 3).map(async id => {
      try { return await findSeries(id, signal); }
      catch (error) { if (error instanceof SonaError && error.status === 404) return; throw error; }
    }));
    for (const card of group) if (card) cards.push(card);
  }
  const remaining = ids.slice(batch.length);
  return { cards, more: remaining.length || cursor ? { ids: remaining, cursor } : undefined };
}

function MoodResults({ guest, viewerId }: { guest: boolean; viewerId: string }) {
  const { t } = useI18n();
  const { mood } = useViewingMood();
  const [cards, setCards] = useState<Card[]>([]);
  const [request, setRequest] = useState<Candidates>({ ids: [], cursor: "" });
  const [more, setMore] = useState<Candidates>();
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setFailed(false);
    loadCandidates(request, controller.signal).then(page => {
      if (controller.signal.aborted) return;
      setCards(current => [...new Map([...current, ...page.cards].map(card => [card.id, card])).values()]);
      setMore(page.more);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [request]);

  const matches = cards.flatMap(card => {
    const term = matchingMoodTerm(mood, card);
    return term ? [{ card, term }] : [];
  });
  const alternatives = !matches.length && cards.length > 0;
  const results = alternatives ? cards.slice(0, 4).map(card => ({ card, term: undefined })) : matches;
  return <>
    <MoodHeading alternatives={alternatives} />
    {results.length > 0 && <ul className={styles.grid}>
      {results.map(({ card, term }) => <li key={card.id}><SeriesCard item={card} card={card} guest={guest} viewerId={viewerId} termLabel={term?.name} startPlayback /></li>)}
    </ul>}
    {!busy && !failed && !results.length && <p className={styles.empty} role="status">
      {t("Сериалов здесь пока нет.", "No series here yet.")} <Link href="/catalog">{t("Открыть каталог", "Browse series")}</Link>
    </p>}
    {busy && <SonaLoader label={t("Подбираем сериалы", "Finding series")} />}
    {failed && <div className={styles.feedback}><span role="alert">{t("Не удалось загрузить подборку.", "Couldn’t load this collection.")}</span>
      <Button className={styles.more} onClick={() => setRequest({ ...request })}>{t("Повторить", "Try again")}</Button></div>}
    {!busy && !failed && more && <Button className={styles.more} onClick={() => setRequest(more)}>{t("Проверить ещё сериалы", "Find more series")}</Button>}
  </>;
}

function MoodHeading({ alternatives = false }: { alternatives?: boolean }) {
  const { t, locale } = useI18n();
  const { mood, choose } = useViewingMood();
  return <div className={styles.heading}>
    <h2 id="mood-heading" aria-live="polite">{alternatives ? t("Другие сериалы", "More series") : moodCopy(mood, locale).shelf}</h2>
    <ToggleGroup.Root className={styles.options} type="single" value={mood} aria-label={t("Фильтр по настроению", "Filter by mood")}
      onValueChange={value => { if (isViewingMood(value)) choose(value); }}>
      {moodOptions.map(id => <ToggleGroup.Item key={id} value={id}>{moodCopy(id, locale).label}</ToggleGroup.Item>)}
    </ToggleGroup.Root>
  </div>;
}

export function MoodShelf() {
  const { t, locale } = useI18n();
  const { me, error, reload } = useSession();
  const section = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!section.current || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, []);
  return <section id="mood-shelf" tabIndex={-1} ref={section} className={styles.section} aria-labelledby="mood-heading">
    {(error || !visible || !me) && <MoodHeading />}
    {error ? <div className={styles.feedback}><span role="alert">{error}</span><Button className={styles.more} onClick={reload}>{t("Повторить", "Try again")}</Button></div>
      : visible && me ? <MoodResults key={JSON.stringify([me.id, me.role, locale])} guest={me.role === "guest"} viewerId={me.id} />
      : <SonaLoader label={t("Подбираем сериалы", "Finding series")} />}
  </section>;
}
