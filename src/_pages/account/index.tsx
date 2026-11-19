"use client";

import { useI18n } from "@/shared/i18n/context";

import { SonaLoader } from "@/shared/ui/sona-loader";
import { InteriorPage } from "@/shared/ui/interior-page";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, CircleCheck, Coins, Flame, Gift, Ticket, WalletCards } from "lucide-react";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { ActionLink } from "@/shared/ui/action-link";
import { useSession } from "@/entities/session";
import { changeContent, getContent } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { usePage } from "@/shared/lib/use-page";
import { Settings } from "./settings";
import styles from "@/shared/styles/account.module.css";

import { checkinCycle } from "./checkin-cycle";
import { ConfirmedCount } from "./confirmed-count";
import finance from "./wallet-rewards.module.css";
import { Monitor, Smartphone } from "lucide-react";
import devices from "./devices.module.css";

type Schemas = components["schemas"];
type Area = "wallet" | "rewards" | "devices" | "settings";
const sections = (t: (russian: string, english: string) => string) => ({
  settings: [t("Настройки профиля", "Profile settings"), t("Войдите, чтобы управлять языком контента, часовым поясом и аккаунтом.", "Sign in to manage your content language, time zone, and account.")],
  wallet: [t("Кошелёк", "Wallet"), t("После входа здесь появятся баланс монет и история операций.", "Sign in to view your coin balance and transaction history.")],
  rewards: [t("Ежедневные награды", "Daily rewards"), t("Войдите, чтобы отмечаться каждый день и собирать монеты за просмотр.", "Sign in to check in daily and earn coins for watching.")],
  devices: [
    t("Устройства", "Devices"),
    t("Войдите, чтобы посмотреть активные устройства и управлять сеансами.", "Sign in to view active devices and manage your sessions."),
  ],
});

function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | Error>("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    load(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e : String(e));
      });
    return () => controller.abort();
  }, [load, version]);
  const reload = useCallback(() => setVersion((n) => n + 1), []);
  return { data, error, reload };
}

function Feedback({ error, retry }: { error: string | Error; retry: () => void }) {
  const { t } = useI18n();
  return error ? (
    <p role="alert">
      {error instanceof Error ? error.message : error} <Button onClick={retry}>{t("Повторить", "Try again")}</Button>
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
  const { t } = useI18n();
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
        <Button onClick={page.more}>{t("Показать ещё", "Show more")}</Button>
      ) : (
        !page.items.length && <p className={styles.muted}>{empty}</p>
      )}
    </>
  );
}

const ledgerKinds = (t: (russian: string, english: string) => string): Record<string, string> => ({
  purchase: t("Покупка", "Purchase"),
  spend: t("Просмотр", "Episode unlock"),
  refund: t("Возврат", "Refund"),
  bonus_grant: t("Бонус", "Bonus"),
  adjustment: t("Корректировка", "Adjustment"),
});

function accountDate(value: string | undefined, zone: string | undefined, locale: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return;
  return new Intl.DateTimeFormat(locale, { timeZone: zone, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

const coinPlural = new Intl.PluralRules("ru");
function coinUnit(value: number, locale: string) {
  if (locale === "en") return value === 1 ? "coin" : "coins";
  const form = coinPlural.select(value);
  return form === "one" ? "монета" : form === "few" ? "монеты" : "монет";
}

function Wallet() {
  const { locale, t } = useI18n();
  const { me } = useSession();
  const deltaFormat = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
  const kinds = ledgerKinds(t);
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
        <section className={finance.balance} aria-label={t("Баланс кошелька", "Wallet balance")}>
          <div className={finance.eyebrow}><WalletCards size={18} aria-hidden="true" />{t("Всего монет", "Total coins")}</div>
          <strong className={finance.amount}><ConfirmedCount value={wallet.data.total} /></strong>
          <dl className={finance.breakdown}>
            <div><dt>{t("Купленные", "Purchased")}</dt><dd>{wallet.data.paid.toLocaleString(locale)}</dd></div>
            <div><dt>{t("Бонусные", "Bonus")}</dt><dd>{wallet.data.bonus.toLocaleString(locale)}</dd></div>
          </dl>
        </section>
      )}
      <section className={finance.ledger}>
        <h2>{t("История операций", "Transaction history")}</h2>
        <AccountList<"LedgerPage">
          key={ledgerVersion}
          path="me/wallet/ledger"
          empty={t("Операций пока нет.", "No transactions yet.")}
          render={(entry) => {
            const Symbol = entry.delta < 0 ? ArrowUpRight : entry.kind === "bonus_grant" ? Gift : ArrowDownLeft;
            return <div className={finance.entry}>
              <span className={finance.entryIcon}><Symbol size={17} aria-hidden="true" /></span>
              <div className={finance.entryDetails}>
                <strong>{kinds[entry.kind] ?? t("Операция", "Transaction")}</strong>
                <small><time dateTime={entry.created_at}>{accountDate(entry.created_at, me?.timezone, locale)}</time></small>
              </div>
              <div className={finance.delta} data-credit={entry.delta > 0}>
                <b>{deltaFormat.format(entry.delta)}</b>
                <small>{entry.coin_type === "paid" ? t("Купленные", "Purchased") : entry.coin_type === "bonus" ? t("Бонусные", "Bonus") : t("Монеты", "Coins")}</small>
              </div>
            </div>;
          }}
        />
      </section>
    </>
  );
}

function Rewards() {
  const { locale, t } = useI18n();
  const { me } = useSession();
  const rewards = useResource(loadRewards);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | [string, string] | null>(null);
  const [receipt, setReceipt] = useState<{ result: Schemas["CheckinResult"]; resetsAt: string }>();
  const key = useRef("");
  const submitting = useRef(false);
  if (rewards.error || !rewards.data) return <Feedback error={rewards.error} retry={rewards.reload} />;
  const [today, streak, daily, wallet] = rewards.data;
  const cycle = checkinCycle(today, receipt && receipt.resetsAt === daily.resets_at ? receipt.result : undefined);
  const reset = accountDate(daily.resets_at, me?.timezone, locale);

  async function claim() {
    if (submitting.current || cycle.checked) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      key.current ||= crypto.randomUUID();
      const result: Schemas["CheckinResult"] = await (
        await changeContent("me/checkin", "POST", undefined, key.current)
      ).json();
      setReceipt({ result, resetsAt: daily.resets_at });
      key.current = "";
      rewards.reload();
    } catch (e) {
      setError(e instanceof Error ? e : ["Не удалось получить награду.", "Couldn’t collect the reward."]);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <div className={finance.rewards}>
    <section className={finance.checkin} aria-label={t("Ежедневная отметка", "Daily check-in")}>
      <div className={finance.eyebrow}><Gift size={18} aria-hidden="true" />{t("Ежедневная отметка", "Daily check-in")}</div>
      <div className={finance.checkinHeading} aria-live="polite" aria-atomic="true">
        {cycle.checked ? <>
          <strong className={finance.done}><CircleCheck size={23} aria-hidden="true" />{t("Сегодня отмечено", "Checked in today")}</strong>
          {cycle.awarded !== undefined && <span className={finance.confirmed}>{t("Начислено монет · +", "Coins added · +")}{cycle.awarded.toLocaleString(locale)}</span>}
        </> : <>
          <strong className={finance.amount}><span aria-hidden="true">+</span><ConfirmedCount value={today.today_reward_coins} /></strong>
          <span className={finance.unit}>{coinUnit(today.today_reward_coins, locale)} {t("за отметку", "for checking in")}</span>
        </>}
      </div>
      <div className={finance.cycleTitle}>{t("День", "Day")} {cycle.day} {t("из 7", "of 7")}</div>
      <ol aria-label={t("Дни цикла", "Check-in days")} className={finance.days}>
        {Array.from({ length: 7 }, (_, index) => {
          const day = index + 1;
          const marked = cycle.marked.has(day);
          return <li key={day} aria-current={day === cycle.day ? "step" : undefined} data-marked={marked}
            aria-label={`${t("День", "Day")} ${day}${marked ? t(", отмечено", ", checked in") : day === cycle.day ? t(", сегодня", ", today") : ""}`}>
            {marked ? <Check size={14} aria-hidden="true" /> : <span className={finance.dayDot} aria-hidden="true" />}
            <span>{day}</span>
          </li>;
        })}
      </ol>
      {cycle.checked
        ? <ActionLink className={finance.walletLink} href="/wallet"><WalletCards size={17} aria-hidden="true" />{t("В кошельке ·", "In your wallet ·")} {wallet.total.toLocaleString(locale)}<ArrowRight size={16} aria-hidden="true" /></ActionLink>
        : <Button className={styles.primary} onClick={claim} disabled={busy} aria-busy={busy}>
          <Coins size={16} aria-hidden="true" />{busy ? t("Получаем…", "Collecting…") : t("Забрать награду", "Collect reward")}
        </Button>}
      {error && <p role="alert">{error instanceof Error ? error.message : t(...error)}</p>}
    </section>
    <div className={finance.stats}>
      <section className={finance.stat}>
        <h2><Flame size={19} aria-hidden="true" />{t("Дни просмотра подряд", "Watch streak")}</h2>
        <strong>{streak.count.toLocaleString(locale)}</strong>
        <p>{t("Личный рекорд ·", "Personal best ·")} {streak.best.toLocaleString(locale)}</p>
        {streak.next_milestone != null && <>
          <progress aria-label={t("До следующей цели", "Progress to the next milestone")} max={streak.next_milestone} value={Math.min(streak.count, streak.next_milestone)} />
          <small>{t("Следующая цель ·", "Next milestone ·")} {streak.next_milestone.toLocaleString(locale)} {t("дн.", streak.next_milestone === 1 ? "day" : "days")}{streak.next_reward_coins != null && streak.next_reward_coins > 0 ? ` · +${streak.next_reward_coins.toLocaleString(locale)} ${coinUnit(streak.next_reward_coins, locale)}` : ""}</small>
        </>}
      </section>
      <section className={finance.stat}>
        <h2><Ticket size={19} aria-hidden="true" />{t("Бесплатные открытия", "Free unlocks")}</h2>
        <strong>{daily.left.toLocaleString(locale)} <span>{t("из", "of")} {daily.limit.toLocaleString(locale)}</span></strong>
        {reset && <p>{t("Обновятся", "Resets")} <time dateTime={daily.resets_at}>{reset}</time></p>}
      </section>
    </div>
  </div>;
}

function Devices() {
  const { locale, t } = useI18n();
  const { me } = useSession();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | [string, string] | null>(null);
  const [notice, setNotice] = useState(false);
  const [version, setVersion] = useState(0);
  const submitting = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const success = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (confirm) cancelButton.current?.focus(); }, [confirm]);
  useEffect(() => { if (notice) success.current?.focus(); }, [notice]);

  function cancel() {
    if (submitting.current) return;
    setConfirm("");
    setError(null);
    trigger.current?.focus();
  }

  async function revoke(device: Schemas["Device"]) {
    if (device.current || device.id !== confirm || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await changeContent("me/devices/" + encodeURIComponent(device.id), "DELETE");
      setConfirm("");
      setVersion(n => n + 1);
      setNotice(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason : ["Не удалось завершить сеансы. Попробуйте ещё раз.", "Couldn’t end the sessions. Try again."]);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <section className={devices.list} aria-label={t("Активные устройства", "Active devices")}>
    {me?.timezone && <p className={devices.zone}>{t("Время в списке ·", "Times shown in ·")} {me.timezone.replaceAll("_", " ")}</p>}
    {notice && <p ref={success} className={devices.notice} role="status" tabIndex={-1}>{t("Сеансы на выбранном устройстве завершены.", "Sessions on the selected device have ended.")}</p>}
    <AccountList<"DeviceList"> key={version} path="me/devices" empty={t("Активных устройств нет.", "No active devices.")}
      render={device => {
        const isWeb = device.platform === "web";
        const Icon = isWeb ? Monitor : Smartphone;
        const platform = isWeb ? t("Браузер", "Browser") : device.platform === "ios" ? t("Приложение iOS", "iOS app") : t("Приложение Android", "Android app");
        const first = accountDate(device.first_seen_at, me?.timezone, locale);
        const last = accountDate(device.last_seen_at, me?.timezone, locale);
        const open = confirm === device.id;
        const dialogId = `device-${device.id}-confirm`;
        return <article className={devices.card} data-current={device.current}>
          <header className={devices.identity}>
            <span className={devices.icon}><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span>
            <div><h2>{platform}</h2>{device.current && <span className={devices.here}><span aria-hidden="true" />{t("Это устройство", "This device")}</span>}</div>
          </header>
          <dl className={devices.facts}>
            {last && <div><dt>{t("Последняя активность", "Last active")}</dt><dd><time dateTime={device.last_seen_at}>{last}</time></dd></div>}
            {first && <div><dt>{t("Первый вход", "First sign-in")}</dt><dd><time dateTime={device.first_seen_at}>{first}</time></dd></div>}
            {device.active_sessions !== undefined && <div><dt>{t("Активных сеансов", "Active sessions")}</dt><dd>{device.active_sessions.toLocaleString(locale)}</dd></div>}
          </dl>
          {!device.current && <Button type="button" className={devices.end} disabled={busy} aria-expanded={open} aria-controls={open ? dialogId : undefined}
            onClick={event => {
              if (open) { cancel(); return; }
              trigger.current = event.currentTarget;
              setError(null); setNotice(false); setConfirm(device.id);
            }}>{t("Завершить сеанс", "End session")}</Button>}
          {open && <div className={devices.confirm} id={dialogId} role="group" aria-labelledby={dialogId + "-title"}
            onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); cancel(); } }}>
            <strong id={dialogId + "-title"}>{t(`Выйти из SONA на устройстве «${platform}»?`, `Sign out of SONA on ${platform}?`)}</strong>
            <p>{t("Будут завершены все сеансы этого устройства.", "All sessions on this device will end.")}</p>
            <div className={devices.actions}>
              <Button type="button" ref={cancelButton} disabled={busy} onClick={cancel}>{t("Отмена", "Cancel")}</Button>
              <Button type="button" className={devices.apply} disabled={busy} aria-busy={busy} onClick={() => revoke(device)}>
                {busy ? t("Завершаем…", "Signing out…") : t("Подтвердить выход", "Confirm sign-out")}
              </Button>
            </div>
            {error && <p className={devices.error} role="alert">{error instanceof Error ? error.message : t(...error)}</p>}
          </div>}
        </article>;
      }} />
  </section>;
}

export function AccountPage({ area }: { area: Area }) {
  const { t } = useI18n();
  const { me, error, reload } = useSession();
  const [title, description] = sections(t)[area];
  return (
    <InteriorPage title={title} back={{ href: "/profile", label: t("Профиль", "Profile") }}
      actions={area === "wallet" && me?.role === "user" && <ActionLink className={styles.primary} href="/shop">{t("Пакеты монет", "Coin packs")} <ArrowUpRight size={16} aria-hidden="true" /></ActionLink>}>
      <div className={styles.content}>
        {error || !me ? (
          <Feedback error={error} retry={reload} />
        ) : me.role === "guest" ? (
          <div className={styles.gate}>
            <p>{description}</p>
            <ActionLink className={styles.primary} href={`/login?next=/${area}`}>
              {t("Войти", "Sign in")}
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
