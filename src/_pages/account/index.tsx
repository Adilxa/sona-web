"use client";

import { SonaLoader } from "@/shared/ui/sona-loader";
import { InteriorPage } from "@/shared/ui/interior-page";
import { ArrowUpRight } from "lucide-react";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { ActionLink } from "@/shared/ui/action-link";
import { useSession } from "@/entities/session";
import { changeContent, getContent } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { usePage } from "@/shared/lib/use-page";
import { Settings } from "./settings";
import styles from "@/shared/styles/account.module.css";

type Schemas = components["schemas"];
type Area = "wallet" | "rewards" | "devices" | "settings";
const sections = {
  settings: ["Настройки профиля", "Войдите, чтобы управлять языком контента, часовым поясом и аккаунтом."],
  wallet: ["Кошелёк", "После входа здесь появятся баланс монет и история операций."],
  rewards: ["Ежедневные награды", "Войдите, чтобы отмечаться каждый день и собирать монеты за просмотр."],
  devices: [
    "Устройства",
    "Войдите, чтобы посмотреть активные устройства и управлять сеансами.",
  ],
};

function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    load(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [load, version]);
  const reload = useCallback(() => setVersion((n) => n + 1), []);
  return { data, error, reload };
}

function Feedback({ error, retry }: { error: string; retry: () => void }) {
  return error ? (
    <p role="alert">
      {error} <Button onClick={retry}>Повторить</Button>
    </p>
  ) : (
    <SonaLoader />
  );
}

const loadWallet = (signal: AbortSignal) => getContent<Schemas["Wallet"]>("me/wallet", signal);
const loadRewards = (signal: AbortSignal) =>
  Promise.all([
    getContent<Schemas["CheckinStatus"]>("me/checkin", signal),
    getContent<Schemas["StreakStatus"]>("me/streak", signal),
    getContent<Schemas["DailyFree"]>("me/daily-free", signal),
    loadWallet(signal),
  ]);

function AccountList<K extends "DeviceList" | "LedgerPage">({
  path,
  render,
  empty,
}: {
  path: string;
  render: (row: Schemas[K]["items"][number]) => ReactNode;
  empty: string;
}) {
  const load = useCallback(
    async (cursor: string, signal: AbortSignal) => {
      const response = await getContent<Schemas[K]>(
        path + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""),
        signal,
      );
      return {
        items: response.items as Schemas[K]["items"][number][],
        next: response.page.has_more ? (response.page.next_cursor ?? "") : "",
      };
    },
    [path],
  );
  const page = usePage(load);
  return (
    <>
      <ul className={styles.rows}>
        {page.items.map((item) => (
          <li key={item.id}>{render(item)}</li>
        ))}
      </ul>
      {page.busy || page.error ? (
        <Feedback error={page.error} retry={page.retry} />
      ) : page.next ? (
        <Button onClick={page.more}>Показать ещё</Button>
      ) : (
        !page.items.length && <p className={styles.muted}>{empty}</p>
      )}
    </>
  );
}

const kinds: Record<string, string> = {
  purchase: "Покупка",
  spend: "Просмотр",
  refund: "Возврат",
  bonus_grant: "Бонус",
  adjustment: "Корректировка",
};

function Wallet() {
  const wallet = useResource(loadWallet);
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const reload = wallet.reload;
  useEffect(() => {
    if (!sessionStorage.getItem("sona-checkout-pending")) return;
    const until = Date.now() + 120_000;
    const refresh = () => {
      if (Date.now() > until) {
        sessionStorage.removeItem("sona-checkout-pending");
        clearInterval(timer);
        return;
      }
      if (!document.hidden) {
        reload();
        setLedgerVersion((n) => n + 1);
      }
    };
    const timer = setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);
  return (
    <>
      {wallet.error || !wallet.data ? (
        <Feedback error={wallet.error} retry={wallet.reload} />
      ) : (
        <div className={styles.balance}>
          <span>Всего монет</span>
          <strong>{wallet.data.total.toLocaleString("ru")}</strong>
          <dl className={styles.breakdown}>
            <div><dt>Купленные</dt><dd>{wallet.data.paid.toLocaleString("ru")}</dd></div>
            <div><dt>Бонусные</dt><dd>{wallet.data.bonus.toLocaleString("ru")}</dd></div>
          </dl>
        </div>
      )}
      <section className={styles.block}>
        <h2>История операций</h2>
        <AccountList<"LedgerPage">
          key={ledgerVersion}
          path="me/wallet/ledger"
          empty="Операций пока нет."
          render={(entry) => (
            <>
              <span>
                {kinds[entry.kind] ?? "Операция"}
                <small>{new Date(entry.created_at).toLocaleString("ru")}</small>
              </span>
              <b>
                {entry.delta > 0 ? "+" : ""}
                {entry.delta}
              </b>
            </>
          )}
        />
      </section>
    </>
  );
}

function Rewards() {
  const rewards = useResource(loadRewards);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [claimed, setClaimed] = useState(false);
  const key = useRef("");
  if (rewards.error || !rewards.data) return <Feedback error={rewards.error} retry={rewards.reload} />;
  const [today, streak, daily, wallet] = rewards.data;
  async function claim() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      key.current ||= crypto.randomUUID();
      const result: Schemas["CheckinResult"] = await (
        await changeContent("me/checkin", "POST", undefined, key.current)
      ).json();
      setClaimed(true);
      key.current = "";
      setMessage(
        result.already_checked_in ? "Вы уже отметились сегодня." : `Начислено монет: ${result.reward_coins}.`,
      );
      rewards.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Не удалось получить награду.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className={styles.balance}>
        <span>Награда сегодня</span>
        <strong>{today.today_reward_coins.toLocaleString("ru")}</strong>
        <p>Монет в кошельке · {wallet.total}</p>
      </div>
      <section className={styles.block}>
        <h2>День {today.current_day_index} из 7</h2>
        <ol aria-label="Дни цикла" className={styles.cycle}>
          {Array.from({ length: 7 }, (_, i) => (
            <li key={i} aria-current={today.current_day_index === i + 1 ? "step" : undefined}>
              {i + 1}
            </li>
          ))}
        </ol>
        <Button className={styles.primary} onClick={claim} disabled={busy || claimed || today.today_checked_in}>
          {claimed || today.today_checked_in ? "Сегодня отмечено" : busy ? "Получаем…" : "Забрать награду"}
        </Button>
        {message && <p role="status">{message}</p>}
      </section>
      <section className={styles.block}>
        <h2>Дни просмотра подряд</h2>
        <p>
          Сейчас · {streak.count}　Личный рекорд · {streak.best}
        </p>
        {streak.next_milestone != null && (
          <p className={styles.muted}>Следующая цель · {streak.next_milestone} дн.</p>
        )}
        <p>
          Бесплатные открытия сегодня · {daily.left} из {daily.limit}
        </p>
      </section>
    </>
  );
}

function Devices() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [confirm, setConfirm] = useState("");
  async function revoke(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await changeContent("me/devices/" + encodeURIComponent(id), "DELETE");
      setConfirm("");
      setVersion((n) => n + 1);
      setMessage("Устройство отключено.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Не удалось завершить сеанс.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className={styles.block}>
        <h2>Активные устройства</h2>
        <AccountList<"DeviceList">
          key={version}
          path="me/devices"
          empty="Активных устройств нет."
          render={(device) => (
            <>
              <span>
                {device.platform === "web" ? "Браузер" : device.platform === "ios" ? "iOS" : "Android"}
                {device.current && " · Это устройство"}
                <small>{new Date(device.last_seen_at).toLocaleString("ru")}</small>
              </span>
              {!device.current &&
                (confirm === device.id ? (
                  <span className={styles.rowActions}>
                    <Button className={styles.danger} disabled={busy} onClick={() => revoke(device.id)}>
                      Подтвердить выход
                    </Button>{" "}
                    <Button disabled={busy} onClick={() => setConfirm("")}>
                      Отмена
                    </Button>
                  </span>
                ) : (
                  <Button disabled={busy} onClick={() => setConfirm(device.id)}>
                    Завершить сеанс
                  </Button>
                ))}
            </>
          )}
        />
      </section>
      {message && <p role="status">{message}</p>}
    </>
  );
}

export function AccountPage({ area }: { area: Area }) {
  const { me, error, reload } = useSession();
  const [title, description] = sections[area];
  return (
    <InteriorPage title={title} back={{ href: "/profile", label: "Профиль" }}
      actions={area === "wallet" && me?.role === "user" && <ActionLink className={styles.primary} href="/shop">Пакеты монет <ArrowUpRight size={16} aria-hidden="true" /></ActionLink>}>
      <div className={styles.content}>
        {error || !me ? (
          <Feedback error={error} retry={reload} />
        ) : me.role === "guest" ? (
          <div className={styles.gate}>
            <p>{description}</p>
            <ActionLink className={styles.primary} href={`/login?next=/${area}`}>
              Войти
            </ActionLink>
          </div>
        ) : area === "settings" ? (
          <Settings me={me} reload={reload} />
        ) : area === "wallet" ? (
          <Wallet key={me.id} />
        ) : area === "devices" ? (
          <Devices key={me.id} />
        ) : (
          <Rewards key={me.id} />
        )}
      </div>
    </InteriorPage>
  );
}
