"use client";

import { useI18n } from "@/shared/i18n/context";

import { SonaLoader } from "@/shared/ui/sona-loader";
import { InteriorPage } from "@/shared/ui/interior-page";
import { Coins } from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { ActionLink } from "@/shared/ui/action-link";
import { ensureSession, requireSuccess } from "@/shared/api/content";
import { useSession } from "@/entities/session";
import type { components } from "@/shared/api/schema";
import styles from "@/shared/styles/account.module.css";

const coinsPlural = new Intl.PluralRules("ru");
function coinCount(count: number, locale: string) {
  if (locale === "en") return count.toLocaleString(locale) + (count === 1 ? " coin" : " coins");
  const form = coinsPlural.select(count);
  return count.toLocaleString(locale) + " " + (form === "one" ? "монета" : form === "few" ? "монеты" : "монет");
}

function price(units: number, currency: string, locale: string) {
  const format = new Intl.NumberFormat(locale, { style: "currency", currency });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  const divisor = 10n ** BigInt(digits);
  const value = BigInt(units);
  return format
    .formatToParts(value / divisor)
    .map((part) => (part.type === "fraction" ? String(value % divisor).padStart(digits, "0") : part.value))
    .join("");
}

export function ShopPage({ purchasable }: { purchasable: string[] }) {
  const { locale, t } = useI18n();
  const { me, error: sessionError, reload } = useSession();
  const [offers, setOffers] = useState<components["schemas"]["ProductOffer"][]>();
  const [error, setError] = useState<Error | null>(null);
  const [buyError, setBuyError] = useState<Error | [string, string] | null>(null);
  const [pendingSku, setPendingSku] = useState<string>();
  const [version, setVersion] = useState(0);
  const intent = useRef({ sku: "", key: "" });
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    async function load() {
      const result = await requireSuccess(
        await fetch("/api/products", { signal: controller.signal, cache: "no-store", headers: { "Accept-Language": locale } }),
      );
      const data: components["schemas"]["ProductOfferList"] = await result.json();
      if (!controller.signal.aborted) setOffers(data.products);
    }
    load().catch((e) => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e : new Error(String(e)));
    });
    return () => controller.abort();
  }, [version, locale]);
  useEffect(() => {
    const returned = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setPendingSku(undefined);
        intent.current = { sku: "", key: "" };
      }
    };
    window.addEventListener("pageshow", returned);
    return () => window.removeEventListener("pageshow", returned);
  }, []);
  async function checkout(sku: string) {
    setBuyError(null);
    setPendingSku(sku);
    if (intent.current.sku !== sku) intent.current = { sku, key: crypto.randomUUID() };
    try {
      await navigator.locks.request("sona-session", ensureSession);
      const response = await requireSuccess(
        await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": intent.current.key },
          body: JSON.stringify({ sku }),
        }),
      );
      const data: components["schemas"]["CheckoutResult"] = await response.json();
      const url = new URL(data.checkout_url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") {
        setBuyError(["Сервис вернул неизвестный адрес оплаты.", "The service returned an unrecognized checkout address."]);
        setPendingSku(undefined);
        return;
      }
      sessionStorage.setItem("sona-checkout-pending", "true");
      window.location.assign(url.href);
    } catch (e) {
      setPendingSku(undefined);
      setBuyError(e instanceof Error ? e : ["Не удалось перейти к оплате.", "Couldn’t open checkout."]);
    }
  }
  return (
    <InteriorPage title={t("Пакеты монет", "Coin packs")} back={{ href: "/wallet", label: t("Кошелёк", "Wallet") }}>
      <div className={styles.content}>
        {error ? (
          <p role="alert">
            {error.message} <Button onClick={() => setVersion((n) => n + 1)}>{t("Повторить", "Try again")}</Button>
          </p>
        ) : !offers ? (
          <SonaLoader label={t("Загружаем пакеты…", "Loading coin packs…")} />
        ) : offers.length === 0 ? (
          <p className={styles.gate}>{t("Сейчас в продаже нет пакетов монет.", "No coin packs are currently on sale.")}</p>
        ) : (
          <ul className={styles.offers}>
            {offers.map((o) => (
              <li key={o.sku}>
                <div className={styles.offerTitle}><Coins size={19} aria-hidden="true" /><strong>{coinCount(o.coins, locale)}</strong></div>
                {o.bonus_coins > 0 && <small>{t("Бонус +", "Bonus +")}{o.bonus_coins.toLocaleString(locale)}</small>}
                {o.amount_minor != null && o.currency && <span className={styles.price}>{price(o.amount_minor, o.currency, locale)}</span>}
                {purchasable.includes(o.sku) ? (
                  me?.role === "user" ? (
                    <Button className={styles.primary} onClick={() => checkout(o.sku)} disabled={pendingSku !== undefined}>
                      {pendingSku === o.sku ? t("Переходим к оплате…", "Opening checkout…") : t("Купить", "Buy")}
                    </Button>
                  ) : me?.role === "guest" && (
                    <ActionLink className={styles.primary} href="/login?next=/shop">
                      {t("Войти для покупки", "Sign in to buy")}
                    </ActionLink>
                  )
                ) : (
                  <small>{t("Оплата временно недоступна", "Payments are temporarily unavailable")}</small>
                )}
              </li>
            ))}
          </ul>
        )}
        {!me && offers?.some(o => purchasable.includes(o.sku)) && (sessionError
          ? <p role="alert">{sessionError} <Button onClick={reload}>{t("Повторить", "Try again")}</Button></p>
          : <SonaLoader label={t("Проверяем сеанс…", "Checking your session…")} />)}
        {buyError && <p role="alert">{buyError instanceof Error ? buyError.message : t(...buyError)}</p>}
      </div>
    </InteriorPage>
  );
}
