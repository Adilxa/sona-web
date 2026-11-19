"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isLocale, localeCookie, type Locale } from "./model";

const translators = {
  ru: (russian: string, _english: string) => russian,
  en: (_russian: string, english: string) => english,
};
type LanguageContext = { locale: Locale; t: typeof translators.ru; setLocale: (value: Locale) => void };
const Context = createContext<LanguageContext>({ locale: "ru", t: translators.ru, setLocale() {} });

function rememberLocale(value: Locale) {
  document.cookie = `${localeCookie}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
  document.documentElement.lang = value;
}

export function LanguageProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, setLanguage] = useState(initial);
  const router = useRouter();
  useEffect(() => {
    function followLink() {
      const explicit = new URL(window.location.href).searchParams.get("lang");
      if (isLocale(explicit)) {
        rememberLocale(explicit);
        setLanguage(explicit);
      }
    }
    followLink();
    window.addEventListener("popstate", followLink);
    return () => window.removeEventListener("popstate", followLink);
  }, [initial]);
  const setLocale = useCallback((next: Locale) => {
    rememberLocale(next);
    const url = new URL(window.location.href);
    if (url.searchParams.has("lang") || ["/", "/catalog", "/feed", "/privacy", "/terms", "/help"].includes(url.pathname) || url.pathname.startsWith("/series/")) {
      url.searchParams.set("lang", next);
      window.history.replaceState(null, "", url);
    }
    setLanguage(next);
    router.refresh();
  }, [router]);
  const value = useMemo(() => ({ locale, t: translators[locale], setLocale }), [locale, setLocale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useI18n = () => useContext(Context);
