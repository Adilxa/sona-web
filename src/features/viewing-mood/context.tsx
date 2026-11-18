"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { defaultMood, isViewingMood, type ViewingMood } from "./model";

const storageKey = "sona.viewing-mood";
const MoodContext = createContext<{ mood: ViewingMood; restored: boolean; choose: (mood: ViewingMood) => void }>({ mood: defaultMood, restored: false, choose: () => {} });

export function MoodProvider({ children }: { children: ReactNode }) {
  const [mood, setMood] = useState(defaultMood);
  const [restored, setRestored] = useState(false);
  const apply = useCallback((value: ViewingMood) => {
    document.documentElement.dataset.mood = value;
    const canvas = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim();
    if (canvas) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", canvas);
    setMood(value);
  }, []);

  useLayoutEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      apply(isViewingMood(saved) ? saved : defaultMood);
    } catch {
      apply(defaultMood);
    }
    setRestored(true);
  }, [apply]);

  const choose = useCallback((value: ViewingMood) => {
    apply(value);
    try { window.localStorage.setItem(storageKey, value); } catch { /* The selection still works for this visit. */ }
  }, [apply]);

  return <MoodContext.Provider value={{ mood, restored, choose }}>{children}</MoodContext.Provider>;
}

export const useViewingMood = () => useContext(MoodContext);
