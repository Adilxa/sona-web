"use client";

import { useI18n } from "@/shared/i18n/context";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { changeContent, getContent } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { DeviceNotifications } from "@/features/notifications/notification-device";
import { SonaLoader } from "@/shared/ui/sona-loader";
import styles from "./profile.module.css";

type Settings = components["schemas"]["NotificationSettings"];
const categories = (t: (russian: string, english: string) => string): { key: keyof Settings; label: string }[] => [
  { key: "new_episode", label: t("Новые серии", "New episodes") },
  { key: "daily_free", label: t("Доступны бесплатные открытия", "Free unlocks available") },
  { key: "streak_expiring", label: t("Напоминание о серии дней", "Watch streak reminder") },
];

export function NotificationSettings({ viewerId }: { viewerId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const queryKey = ["notification-settings", viewerId];
  const prefs = useQuery({ queryKey, enabled: open, queryFn: ({ signal }) => getContent<Settings>("me/notification-settings", signal) });
  const save = useMutation({
    mutationFn: async (patch: Partial<Settings>): Promise<Settings> => (await changeContent("me/notification-settings", "PATCH", patch)).json(),
    onSuccess: settings => client.setQueryData(queryKey, settings),
  });
  return <details className={styles.notifications} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>{t("Уведомления", "Notifications")} <ChevronDown size={18} aria-hidden="true" /></summary>
    {open && <div className={styles.channels}>
      <DeviceNotifications />
      {prefs.isPending ? <SonaLoader label={t("Загружаем настройки…", "Loading settings…")} /> :
        prefs.isError ? <p role="alert">{t("Настройки недоступны.", "Settings are unavailable.")} <button onClick={() => prefs.refetch()}>{t("Повторить", "Try again")}</button></p> :
        categories(t).map(({key, label}) => <label key={key} className={styles.switchRow}>
          <span>{label}</span><input type="checkbox" role="switch" checked={prefs.data[key]} disabled={save.isPending}
            onChange={e => save.mutate({ [key]: e.currentTarget.checked })} />
        </label>)}
      <span role="status" className={styles.response}>{save.isPending ? t("Сохраняем…", "Saving…") : save.isSuccess ? t("Изменения сохранены", "Changes saved") : ""}</span>
      {save.isError && <p role="alert">{t("Не удалось сохранить.", "Couldn’t save your changes.")} <button onClick={() => save.mutate(save.variables!)}>{t("Повторить", "Try again")}</button></p>}
    </div>}
  </details>;
}
