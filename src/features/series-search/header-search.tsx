"use client";

import { useI18n } from "@/shared/i18n/context";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { loadCollection, type CatalogTile } from "@/entities/series";
import { EpisodeCount } from "@/entities/series/ui/episode-count";
import { localizedPath, seriesPath } from "@/shared/seo/urls";
import { useSession } from "@/entities/session";
import { BrandIcon } from "@/shared/ui/brand-icon";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { useCatalogSuggestions } from "./catalog-suggestions";
import styles from "./header-search.module.css";

type Reply = { key: string; items?: CatalogTile[]; error?: string };
const empty: CatalogTile[] = [];

function OpenFromLink({ open }: { open: (query: string) => void }) {
  const params = useSearchParams();
  const query = params.get("search");
  useEffect(() => {
    if (query === null) return;
    open(query.slice(0, 100));
    const url = new URL(window.location.href);
    url.searchParams.delete("search");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [query, open]);
  return null;
}

export function HeaderSearch() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { me, error: sessionError, reload } = useSession();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<Reply>();
  const [selectedId, setSelectedId] = useState<string>();
  const [readyKey, setReadyKey] = useState("");
  const [attempt, setAttempt] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const query = text.trim();
  const valid = open && query.length >= 2;
  const key = JSON.stringify([query, me?.id, locale, attempt]);
  const result = reply?.key === key ? reply : undefined;
  const catalog = useCatalogSuggestions(query, valid && me ? String(me.id) : undefined, locale,
    valid && readyKey === key, result?.items ?? empty);
  const items = catalog.items;
  const error = valid && (sessionError || result?.error || catalog.error);
  const busy = valid && !sessionError && (!result || catalog.pending);
  const expanded = open && query.length > 0;
  const index = items.findIndex(item => item.id === selectedId);
  const selection = items[index];

  const openLink = useCallback((value: string) => {
    setText(value);
    setOpen(true);
    setSelectedId(undefined);
  }, []);
  function dismiss(restore = false) {
    setOpen(false);
    setText("");
    setSelectedId(undefined);
    setReadyKey("");
    setReply(undefined);
    if (restore) button.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!valid || !me) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setReadyKey(key);
      loadCollection("catalog", query, "", controller.signal, { summariesOnly: true })
        .then(({ items }) => { if (!controller.signal.aborted) setReply({ key, items }); })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setReply({ key, error: cause instanceof Error ? cause.message : t("Не удалось выполнить поиск.", "Search failed. Please try again.") });
        });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [valid, query, key, me, t]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus({ preventScroll: true });
    function outside(event: Event) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) dismiss();
    }
    function fitKeyboard() {
      const viewport = window.visualViewport;
      const field = shell.current;
      if (!field || !viewport) return;
      const available = viewport.height + viewport.offsetTop - field.getBoundingClientRect().bottom - 16;
      field.style.setProperty("--search-space", Math.max(0, available) + "px");
    }
    fitKeyboard();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    window.visualViewport?.addEventListener("resize", fitKeyboard);
    window.visualViewport?.addEventListener("scroll", fitKeyboard);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      window.visualViewport?.removeEventListener("resize", fitKeyboard);
      window.visualViewport?.removeEventListener("scroll", fitKeyboard);
    };
  }, [open]);

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && items.length) {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index <= 0 ? items.length - 1 : index - 1);
      setSelectedId(items[next].id);
      document.getElementById(listId + "-" + next)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && items.length) {
      event.preventDefault();
      const item = selection ?? items[0];
      router.push(localizedPath(seriesPath(item.id, item.slug), locale));
      dismiss(true);
    }
  }

  return <div className={styles.root} ref={root} onKeyDown={event => {
    if (open && event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); dismiss(true); }
  }}>
    <Suspense fallback={null}><OpenFromLink open={openLink} /></Suspense>
    <Button ref={button} className={styles.trigger} aria-label={t("Поиск", "Search")} aria-expanded={open}
      tabIndex={open ? -1 : 0} onClick={() => {
        flushSync(() => setOpen(true));
        input.current?.focus({ preventScroll: true });
      }}><BrandIcon name="search" /></Button>
    {open && <div className={styles.shell} ref={shell} role="search" aria-label={t("Поиск сериалов", "Search series")}>
      <BrandIcon name="search" size={18} />
      <input ref={input} className={styles.input} type="text" role="combobox" aria-label={t("Название сериала", "Series title")}
        aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
        aria-activedescendant={selection ? listId + "-" + index : undefined}
        autoComplete="off" autoCapitalize="none" enterKeyHint="go" maxLength={100}
        placeholder={t("Найти сериал", "Search series")} value={text} onKeyDown={keys}
        onChange={event => { setText(event.target.value); setSelectedId(undefined); }} />
      <Button className={styles.close} onClick={() => dismiss(true)} aria-label={t("Закрыть поиск", "Close search")}><BrandIcon name="close" size={15} /></Button>
      {expanded && <div className={styles.dropdown}>
        <ul id={listId} role="listbox" aria-label={t("Найденные сериалы", "Search results")} aria-busy={busy}>
          {items.map((item, i) => <li role="presentation" key={item.id}>
            <Link role="option" id={listId + "-" + i} aria-selected={index === i} tabIndex={-1}
              href={localizedPath(seriesPath(item.id, item.slug), locale)} prefetch={false} className={styles.result}
              onMouseDown={event => { if (event.button === 0) event.preventDefault(); }}
              onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) dismiss(true); }}>
              <span><strong>{item.title}</strong><EpisodeCount total={item.episodesCount} /></span>
              <BrandIcon name="arrow" size={17} />
            </Link>
          </li>)}
        </ul>
        {!valid ? <p role="status">{t("Введите ещё один символ", "Type one more character")}</p>
          : error ? <div className={styles.notice} role="alert">{error}<Button onClick={() => {
            if (sessionError) reload();
            else {
              if (catalog.error) void catalog.retry();
              if (result?.error) setAttempt(n => n + 1);
            }
          }}>{t("Повторить", "Try again")}</Button></div>
          : busy && !items.length ? <div className={styles.notice}><SonaLoader label={t("Ищем сериал…", "Searching for series…")} /></div>
          : !items.length && <p role="status">{t("Сериал не найден. Попробуйте другое название.", "No series found. Try another title.")}</p>}
      </div>}
    </div>}
  </div>;
}
