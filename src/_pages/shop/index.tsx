"use client";

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
function coinCount(count: number) {
  const form = coinsPlural.select(count);
  return count.toLocaleString("ru") + " " + (form === "one" ? "монета" : form === "few" ? "монеты" : "монет");
}

function price(units: number, currency: string) {
  const format = new Intl.NumberFormat("ru", { style: "currency", currency });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  const divisor = 10n ** BigInt(digits);
  const value = BigInt(units);
  return format
    .formatToParts(value / divisor)
    .map((part) => (part.type === "fraction" ? String(value % divisor).padStart(digits, "0") : part.value))
    .join("");
}

export function ShopPage({ purchasable }: { purchasable: string[] }) {
  const { me, error: sessionError, reload } = useSession();
  const [offers, setOffers] = useState<components["schemas"]["ProductOffer"][]>();
  const [error, setError] = useState("");
  const [buyError, setBuyError] = useState("");
  const [pendingSku, setPendingSku] = useState<string>();
  const [version, setVersion] = useState(0);
  const intent = useRef({ sku: "", key: "" });
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    async function load() {
      const result = await requireSuccess(
        await fetch("/api/products", { signal: controller.signal, cache: "no-store" }),
      );
      const data: components["schemas"]["ProductOfferList"] = await result.json();
      if (!controller.signal.aborted) setOffers(data.products);
    }
    load().catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, [version]);
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
    setBuyError("");
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
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
        throw Error("Сервис вернул неизвестный адрес оплаты.");
      sessionStorage.setItem("sona-checkout-pending", "true");
      window.location.assign(url.href);
    } catch (e) {
      setPendingSku(undefined);
      setBuyError(e instanceof Error ? e.message : "Не удалось перейти к оплате.");
    }
  }
  return (
    <InteriorPage title="Пакеты монет" back={{ href: "/wallet", label: "Кошелёк" }}>
      <div className={styles.content}>
        {error ? (
          <p role="alert">
            {error} <Button onClick={() => setVersion((n) => n + 1)}>Повторить</Button>
          </p>
        ) : !offers ? (
          <SonaLoader label="Загружаем пакеты…" />
        ) : offers.length === 0 ? (
          <p className={styles.gate}>Сейчас в продаже нет пакетов монет.</p>
        ) : (
          <ul className={styles.offers}>
            {offers.map((o) => (
              <li key={o.sku}>
                <div className={styles.offerTitle}><Coins size={19} aria-hidden="true" /><strong>{coinCount(o.coins)}</strong></div>
                {o.bonus_coins > 0 && <small>Бонус +{o.bonus_coins.toLocaleString("ru")}</small>}
                {o.amount_minor != null && o.currency && <span className={styles.price}>{price(o.amount_minor, o.currency)}</span>}
                {purchasable.includes(o.sku) ? (
                  me?.role === "user" ? (
                    <Button className={styles.primary} onClick={() => checkout(o.sku)} disabled={pendingSku !== undefined}>
                      {pendingSku === o.sku ? "Переходим к оплате…" : "Купить"}
                    </Button>
                  ) : me?.role === "guest" && (
                    <ActionLink className={styles.primary} href="/login?next=/shop">
                      Войти для покупки
                    </ActionLink>
                  )
                ) : (
                  <small>Оплата временно недоступна</small>
                )}
              </li>
            ))}
          </ul>
        )}
        {!me && offers?.some(o => purchasable.includes(o.sku)) && (sessionError
          ? <p role="alert">{sessionError} <Button onClick={reload}>Повторить</Button></p>
          : <SonaLoader label="Проверяем сеанс…" />)}
        {buyError && <p role="alert">{buyError}</p>}
      </div>
    </InteriorPage>
  );
}
