"use client";

import { useI18n } from "@/shared/i18n/context";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
declare global {
  interface Window {
    turnstile?: {
      render(
        element: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          theme: string;
          language: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ): string;
      remove(id: string): void;
    };
  }
}
export function BotCheck({ onToken }: { onToken: (token: string) => void }) {
  const { locale, t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const sdk = window.turnstile;
    if (!sitekey || !ready || !container.current || !sdk) return;
    const id = sdk.render(container.current, {
      sitekey,
      action: "otp",
      theme: "dark",
      language: locale,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => {
        onToken("");
        setError(true);
      },
    });
    return () => { sdk.remove(id); onToken(""); };
  }, [ready, onToken, locale]);
  if (!sitekey) return <p role="alert">{t("Проверка регистрации временно недоступна. Попробуйте позже.", "Registration verification is temporarily unavailable. Try again later.")}</p>;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => setError(true)}
      />
      <div ref={container} />
      {error && <p role="alert">{t("Не удалось загрузить проверку устройства.", "Couldn’t load device verification.")}</p>}
    </>
  );
}
