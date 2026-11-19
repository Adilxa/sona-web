"use client";

import { useI18n } from "@/shared/i18n/context";
import { LanguageSelect } from "@/shared/i18n/language-select";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { authenticate } from "@/entities/session";
import { changeContent, SonaError } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import styles from "@/shared/styles/account.module.css";
import form from "./settings.module.css";
import { languageChoices, localePattern, preferenceChanges, zoneChoices, zoneDate, zonePattern } from "./settings-options";

type Me = components["schemas"]["Me"];
const other = "__other__";
// The session refresh remounts this page after a successful change.
let lastSave: { viewer: string; time: number } | undefined;

function PreferenceSelect({ label, value, onChange, options, customLabel, pattern, maxLength, example, hint, disabled }: {
  label: string; value: string; onChange: (value: string) => void; options: ReactNode;
  customLabel: string; pattern: string; maxLength: number; example: string; hint?: string; disabled: boolean;
}) {
  const id = useId();
  const [custom, setCustom] = useState(false);
  const describedBy = hint ? id + "-hint" : undefined;
  return <div className={form.field}>
    <label htmlFor={id}>{label}</label>
    <div className={form.control}>
      <select id={id} value={custom ? other : value} disabled={disabled} aria-describedby={describedBy}
        onChange={event => {
          const selected = event.target.value;
          setCustom(selected === other);
          onChange(selected === other ? "" : selected);
        }}>
        {options}
        <option value={other}>{customLabel}…</option>
      </select>
      <ChevronDown size={17} aria-hidden="true" />
    </div>
    {custom && <label className={form.custom}>
      {example}
      <input autoFocus required value={value} disabled={disabled} autoCapitalize="none" autoComplete="off"
        spellCheck={false} maxLength={maxLength} pattern={pattern} aria-describedby={describedBy}
        onChange={event => onChange(event.target.value)} />
    </label>}
    {hint && <small id={describedBy} className={form.hint}>{hint}</small>}
  </div>;
}

function Preferences({ me, reload, busy, setBusy }: { me: Me; reload: () => void; busy: boolean; setBusy: (value: boolean) => void }) {
  const { locale: uiLocale, t } = useI18n();
  const [saved, setSaved] = useState(me);
  const [locale, setLocale] = useState(me.locale ?? "");
  const [timezone, setTimezone] = useState(me.timezone);
  const [deniedUntil, setDeniedUntil] = useState("");
  const [clock, setClock] = useState(Date.now);
  const [error, setError] = useState<Error | [string, string] | null>(null);
  const [success, setSuccess] = useState(false);
  const pending = useRef(false);
  const allowedAt = deniedUntil || saved.timezone_change_allowed_at;
  const deadline = Date.parse(allowedAt ?? "");
  const locked = deadline > clock;
  const changes = preferenceChanges(saved, locale, timezone, locked);
  const hasChanges = Object.keys(changes).length > 0;
  const languages = useMemo(() => languageChoices(saved.locale, typeof navigator === "undefined" ? [] : navigator.languages, uiLocale), [saved.locale, uiLocale]);
  const zones = useMemo(() => zoneChoices(saved.timezone, uiLocale), [saved.timezone, uiLocale]);
  useEffect(() => {
    if (lastSave?.viewer === me.id && Date.now() - lastSave.time < 15_000) {
      lastSave = undefined;
      setSuccess(true);
    }
  }, [me.id]);
  useEffect(() => {
    if (!Number.isFinite(deadline)) return;
    let timer: ReturnType<typeof setTimeout>;
    function update() {
      clearTimeout(timer);
      const now = Date.now();
      setClock(now);
      if (deadline > now) timer = setTimeout(update, Math.min(deadline - now, 2_147_483_647));
    }
    update();
    document.addEventListener("visibilitychange", update);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", update); };
  }, [deadline]);

  function edit(update: (value: string) => void, value: string) {
    setSuccess(false);
    setError(null);
    update(value);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || pending.current || !hasChanges || !event.currentTarget.reportValidity()) return;
    pending.current = true;
    setBusy(true);
    setSuccess(false);
    setError(null);
    try {
      const response = await changeContent("me", "PATCH", changes);
      const updated: Me = await response.json();
      setSaved(updated);
      setLocale(updated.locale ?? "");
      setTimezone(updated.timezone);
      setDeniedUntil("");
      setSuccess(true);
      lastSave = { viewer: me.id, time: Date.now() };
      reload();
    } catch (cause) {
      if (cause instanceof SonaError && cause.code === "timezone_change_too_soon") {
        const problem = cause.problem;
        if (problem && "allowed_at" in problem && typeof problem.allowed_at === "string" && Date.parse(problem.allowed_at) > Date.now()) {
          setDeniedUntil(problem.allowed_at);
          setClock(Date.now());
          setTimezone(saved.timezone);
        }
      }
      if (cause instanceof SonaError && cause.status === 400) {
        setError(["Проверьте код языка и название часового пояса.", "Check the language code and time zone name."]);
      } else {
        setError(cause instanceof Error ? cause : ["Не удалось сохранить настройки.", "Couldn’t save your settings."]);
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const zoneHint = locked ? t("Изменить можно с ", "You can change it on ") + zoneDate(allowedAt, saved.timezone, false, uiLocale) + "."
    : zoneDate(new Date(clock).toISOString(), timezone, true, uiLocale);
  return <section className={styles.block}>
    <h2>{t("Язык и часовой пояс", "Language and time zone")}</h2>
    <form className={form.form} onSubmit={save} aria-label={t("Язык и часовой пояс", "Language and time zone")} aria-busy={busy}>
      <LanguageSelect />
      <PreferenceSelect label={t("Язык контента", "Content language")} value={locale} onChange={value => edit(setLocale, value)} disabled={busy}
        options={<>{!saved.locale && <option value="">{t("По умолчанию", "Default")}</option>}
          {languages.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</>}
        customLabel={t("Другой язык", "Another language")} example={t("Код языка, например pt-BR", "Language code, e.g. pt-BR")} pattern={localePattern} maxLength={35} />
      <PreferenceSelect key={locked ? "locked" : "open"} label={t("Часовой пояс", "Time zone")} value={timezone} onChange={value => edit(setTimezone, value)}
        disabled={busy || locked} hint={zoneHint}
        options={zones.map(group => <optgroup key={group.label} label={group.label}>
          {group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </optgroup>)} customLabel={t("Другой часовой пояс", "Another time zone")} example={t("Название IANA, например Asia/Bishkek", "IANA name, e.g. Asia/Bishkek")} pattern={zonePattern} maxLength={64} />
      <div className={form.actions}>
        <Button type="submit" className={styles.primary} disabled={busy || !hasChanges}>{pending.current ? t("Сохраняем…", "Saving…") : t("Сохранить изменения", "Save changes")}</Button>
        <span role="status">{success ? t("Изменения сохранены", "Changes saved") : ""}</span>
      </div>
      {error && <p className={form.error} role="alert">{error instanceof Error ? error.message : t(...error)}</p>}
    </form>
  </section>;
}

export function Settings({ me, reload }: { me: components["schemas"]["Me"]; reload: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Error | [string, string] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const focus = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirm) focus.current?.focus();
  }, [confirm]);
  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      await authenticate("delete-account");
      router.replace("/profile");
    } catch (e) {
      setMessage(e instanceof Error ? e : ["Не удалось отправить запрос.", "Couldn’t send the request."]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Preferences key={JSON.stringify([me.id, me.locale, me.timezone, me.timezone_change_allowed_at])}
        me={me} busy={busy} setBusy={setBusy} reload={reload} />
      <section className={styles.block}>
        <h2>{t("Удаление аккаунта", "Delete account")}</h2>
        {confirm ? (
          <>
            <p>{t("Все устройства выйдут из аккаунта. Вход до даты удаления отменит запрос.", "You’ll be signed out on all devices. Signing in before the deletion date cancels the request.")}</p>
            <div className={styles.rowActions}>
              <Button ref={focus} onClick={() => setConfirm(false)} disabled={busy}>{t("Оставить аккаунт", "Keep account")}</Button>
              <Button className={styles.danger} onClick={remove} disabled={busy}>{t("Подтвердить удаление", "Confirm deletion")}</Button>
            </div>
          </>
        ) : (
          <Button onClick={() => setConfirm(true)}>{t("Запросить удаление", "Request deletion")}</Button>
        )}
      </section>
      {message && <p role="alert">{message instanceof Error ? message.message : t(...message)}</p>}
    </>
  );
}
