"use client";

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
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => {
        onToken("");
        setError(true);
      },
    });
    return () => sdk.remove(id);
  }, [ready, onToken]);
  if (!sitekey) return <p role="alert">Проверка регистрации временно недоступна. Попробуйте позже.</p>;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => setError(true)}
      />
      <div ref={container} />
      {error && <p role="alert">Не удалось загрузить проверку устройства.</p>}
    </>
  );
}
