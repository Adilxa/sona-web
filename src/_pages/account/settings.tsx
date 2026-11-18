"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@animate-ui/react/primitives/buttons/button";
import { useRouter } from "next/navigation";
import { authenticate } from "@/entities/session";
import { changeContent } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import styles from "@/shared/styles/account.module.css";

export function Settings({ me, reload }: { me: components["schemas"]["Me"]; reload: () => void }) {
  const [timezone, setTimezone] = useState(me.timezone);
  const [locale, setLocale] = useState(me.locale ?? "ru");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const focus = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirm) focus.current?.focus();
  }, [confirm]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const values: components["schemas"]["MeUpdate"] = { locale: locale.trim(), timezone: timezone.trim() };
      await changeContent("me", "PATCH", values);
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Не удалось сохранить настройки.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setMessage("");
    try {
      await authenticate("delete-account");
      router.replace("/profile");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Не удалось отправить запрос.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className={styles.block}>
        <h2>Язык и часовой пояс</h2>
        <form className={styles.accountForm} onSubmit={save}>
          <label>
            Язык контента
            <input required autoCapitalize="none" spellCheck={false} value={locale} onChange={(e) => setLocale(e.target.value)} placeholder="ru" />
          </label>
          <label>
            Часовой пояс
            <input
              required
              autoCapitalize="none" spellCheck={false}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Bishkek"
            />
          </label>
          {me.timezone_change_allowed_at && (
            <small>
              Часовой пояс можно менять с {new Date(me.timezone_change_allowed_at).toLocaleString("ru")}.
            </small>
          )}
          <Button
            type="submit" className={styles.primary}
            disabled={busy || (locale === (me.locale ?? "ru") && timezone === me.timezone)}
          >
            Сохранить изменения
          </Button>
        </form>
      </section>
      <section className={styles.block}>
        <h2>Удаление аккаунта</h2>
        {confirm ? (
          <>
            <p>Все устройства выйдут из аккаунта. Вход до даты удаления отменит запрос.</p>
            <div className={styles.rowActions}>
              <Button ref={focus} onClick={() => setConfirm(false)} disabled={busy}>Оставить аккаунт</Button>
              <Button className={styles.danger} onClick={remove} disabled={busy}>Подтвердить удаление</Button>
            </div>
          </>
        ) : (
          <Button onClick={() => setConfirm(true)}>Запросить удаление</Button>
        )}
      </section>
      {message && <p role="alert">{message}</p>}
    </>
  );
}
