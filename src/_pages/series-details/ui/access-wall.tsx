"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { ActionLink } from "@/shared/ui/action-link";
import { changeContent, SonaError } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { wallScrollEdge } from "./player-gesture";
import styles from "./access-wall.module.css";

type Schema = components["schemas"];

function resetLabel(date?: string) {
  if (!date) return "";
  const reset = new Date(date);
  if (!Number.isFinite(reset.valueOf())) return "";
  return new Intl.DateTimeFormat("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(reset);
}

export function AccessWall({ episode, number, problem, guest, returnPath, onUnlocked }: {
  episode: number;
  number: number;
  problem: Schema["LockedProblem"];
  guest: boolean;
  returnPath: string;
  onUnlocked: () => void;
}) {
  const inFlight = useRef(false);
  const intents = useRef(new Map<string, string>());
  const active = useRef(true);
  const panel = useRef<HTMLElement>(null);
  const [pending, setPending] = useState<Schema["UnlockOption"]["method"]>();
  const [error, setError] = useState<Error>();
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const measure = () => { element.dataset.scrollEdge = wallScrollEdge(element); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    element.addEventListener("scroll", measure, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", measure); };
  }, [problem, guest, pending, error]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function open(method: Schema["UnlockOption"]["method"]) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(method);
    setError(undefined);
    const key = intents.current.get(method) ?? crypto.randomUUID();
    intents.current.set(method, key);
    try {
      await changeContent(`episodes/${episode}/unlock`, "POST", { method }, key);
      intents.current.delete(method);
      if (active.current) onUnlocked();
    } catch (reason) {
      if (reason instanceof SonaError && reason.status >= 400 && reason.status < 500 && reason.status !== 429) {
        intents.current.delete(method);
      }
      if (active.current) setError(reason instanceof Error ? reason : new Error("Не удалось открыть серию."));
    } finally {
      inFlight.current = false;
      if (active.current) setPending(undefined);
    }
  }

  const needsLogin = guest || problem.reason === "registration_required";
  const options = needsLogin ? [] : problem.unlock_options ?? [];
  const daily = options.find(option => option.method === "daily_free");
  const prices = options.filter(option => option.method !== "daily_free");
  const reset = daily?.daily_left === 0 ? resetLabel(daily.resets_at) : "";
  return <section ref={panel} className={styles.wall} data-access-wall aria-labelledby="access-title">
    <div className={styles.heading}>
      <span className={styles.eyebrow}><LockKeyhole size={14} aria-hidden="true" /> Серия {number}</span>
      <h2 id="access-title">{problem.reason === "vip" ? "Доступ по VIP" : needsLogin ? "Продолжить просмотр" : "Открыть серию"}</h2>
    </div>
    {needsLogin ? <>
      <p className={styles.note}>Войдите, чтобы увидеть варианты доступа к этой серии.</p>
      <ActionLink className={styles.primary} href={`/login?next=${encodeURIComponent(returnPath)}`}>Войти и продолжить <ArrowRight size={17} aria-hidden="true" /></ActionLink>
    </> : <>
      {daily && <div className={styles.daily}>
        <Button className={styles.primary} disabled={!!pending || daily.daily_left === 0} aria-busy={pending === "daily_free"}
          onClick={() => open("daily_free")}>
          {pending === "daily_free" ? "Открываем…" : "Открыть бесплатно"} <ArrowRight size={17} aria-hidden="true" />
        </Button>
        {daily.daily_left != null && <small>{daily.daily_left > 0 ? `Осталось на сегодня: ${daily.daily_left}` : reset ? `Новые открытия — ${reset}` : "Бесплатные открытия на сегодня закончились"}</small>}
      </div>}
      {prices.length > 0 && <div className={styles.prices}>
        {prices.map(option => {
          const priced = Number.isSafeInteger(option.price_coins) && (option.price_coins ?? -1) >= 0;
          return <Button key={option.method} className={styles.price} disabled={!!pending || !priced}
            aria-busy={pending === option.method} onClick={() => open(option.method)}>
            <span>{pending === option.method ? "Открываем…" : option.method === "series_bundle" ? "Весь сериал" : "Эта серия"}</span>
            <strong>{priced ? `${option.price_coins} мон.` : "Цена недоступна"}</strong>
          </Button>;
        })}
      </div>}
      {!options.length && <p className={styles.note}>Сейчас вариантов открытия нет.</p>}
    </>}
    {error && <p role="alert" className={styles.error}>{error.message} {error instanceof SonaError && error.code === "insufficient_coins" && <ActionLink href="/shop">Пополнить кошелёк</ActionLink>}</p>}
  </section>;
}
