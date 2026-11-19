"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const empty = "[]";
const changed = "sona:continue-pin-change";
const temporary = new Map<string, boolean>();
const prefix = (viewer: string) => `sona.continue-pins.v1:${encodeURIComponent(viewer)}:`;

// One key per series lets two tabs pin different titles without overwriting each other.
export function continuePinSnapshot(viewer?: string) {
  if (!viewer || typeof window === "undefined") return empty;
  const scope = prefix(viewer);
  const ids = new Set<string>();
  try {
    const storage = window.localStorage;
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(scope)) ids.add(key.slice(scope.length));
    }
  } catch { /* Storage can be disabled by browser settings. */ }
  for (const [key, pinned] of temporary) {
    if (!key.startsWith(scope)) continue;
    const id = key.slice(scope.length);
    if (pinned) ids.add(id);
    else ids.delete(id);
  }
  return JSON.stringify([...ids].sort());
}

export function setContinuePin(viewer: string, series: string, pinned: boolean) {
  const key = prefix(viewer) + series;
  try {
    if (pinned) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
    temporary.delete(key);
  } catch {
    temporary.set(key, pinned);
  }
  window.dispatchEvent(new CustomEvent(changed, { detail: viewer }));
}

export function subscribeContinuePins(viewer: string | undefined, notify: () => void) {
  if (!viewer) return () => {};
  const scope = prefix(viewer);
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key.startsWith(scope)) notify();
  }
  function onLocal(event: Event) {
    if ((event as CustomEvent<string>).detail === viewer) notify();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(changed, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changed, onLocal);
  };
}

export function useContinuePins(viewer?: string) {
  const subscribe = useCallback((notify: () => void) => subscribeContinuePins(viewer, notify), [viewer]);
  const read = useCallback(() => continuePinSnapshot(viewer), [viewer]);
  const snapshot = useSyncExternalStore(subscribe, read, () => empty);
  return useMemo(() => new Set<string>(JSON.parse(snapshot)), [snapshot]);
}

export function pinnedFirst<T>(items: T[], pins: ReadonlySet<string>, idOf: (item: T) => string) {
  if (!pins.size) return items;
  const pinned: T[] = [], rest: T[] = [];
  for (const item of items) (pins.has(idOf(item)) ? pinned : rest).push(item);
  return [...pinned, ...rest];
}
