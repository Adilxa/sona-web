"use client";

import { useEffect, useState } from "react";

export function usePage<T>(load: (cursor: string, signal: AbortSignal) => Promise<{items: T[]; next: string}>) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    load(cursor, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setItems(previous => cursor ? [...previous, ...result.items] : result.items);
      setNext(result.next);
    }).catch((e) => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Не удалось загрузить данные.");
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, [load, cursor, attempt]);
  return { items, busy, error, next, more: () => setCursor(next), retry: () => setAttempt(n => n + 1) };
}
