"use client";

import { useEffect, useRef, useState } from "react";
import { findSeries } from "../api/catalog";

type Card = Awaited<ReturnType<typeof findSeries>>;

// Catalogue summaries can precede their full metadata. Read up to four visible titles at a time.
export function useSeriesCardDetails<T extends HTMLElement>(items: readonly unknown[], onDetails?: (card: Card) => void) {
  const container = useRef<T>(null);
  const settled = useRef(new Set<string>());
  const [cards, setCards] = useState<Record<string, Card>>({});

  useEffect(() => {
    if (!container.current || !items.length) return;
    const controller = new AbortController();
    const { signal } = controller;
    const queue: string[] = [];
    const queued = new Set(settled.current);
    let running = 0;

    function drain() {
      while (!signal.aborted && running < 4 && queue.length) {
        const id = queue.shift()!;
        running++;
        findSeries(id, signal).then(card => {
          if (signal.aborted) return;
          setCards(current => ({ ...current, [id]: card }));
          onDetails?.(card);
        }).catch(() => {
          // Keep the server's original title/link usable if extra details fail.
        }).finally(() => {
          if (!signal.aborted) settled.current.add(id);
          running--;
          drain();
        });
      }
    }

    function enqueue(element: Element) {
      const id = (element as HTMLElement).dataset.series;
      if (!id || queued.has(id)) return;
      queued.add(id);
      queue.push(id);
    }

    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer?.unobserve(entry.target);
        enqueue(entry.target);
      }
      drain();
    }, { rootMargin: "180px" }) : null;

    for (const tile of container.current.querySelectorAll("[data-series]")) {
      if (observer) observer.observe(tile);
      else enqueue(tile);
    }
    drain();
    return () => { observer?.disconnect(); controller.abort(); };
  }, [items, onDetails]);

  return { container, cards };
}
