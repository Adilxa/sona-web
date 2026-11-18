"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { changeContent, getContent } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";
import { DeviceNotifications } from "@/features/notifications/notification-device";
import { SonaLoader } from "@/shared/ui/sona-loader";
import styles from "./profile.module.css";

type Settings = components["schemas"]["NotificationSettings"];
const categories: { key: keyof Settings; label: string }[] = [
  { key: "new_episode", label: "Новые серии" },
  { key: "daily_free", label: "Доступны бесплатные открытия" },
  { key: "streak_expiring", label: "Напоминание о серии дней" },
];

export function NotificationSettings({ viewerId }: { viewerId: string }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const queryKey = ["notification-settings", viewerId];
  const prefs = useQuery({ queryKey, enabled: open, queryFn: ({ signal }) => getContent<Settings>("me/notification-settings", signal) });
  const save = useMutation({
    mutationFn: async (patch: Partial<Settings>): Promise<Settings> => (await changeContent("me/notification-settings", "PATCH", patch)).json(),
    onSuccess: settings => client.setQueryData(queryKey, settings),
  });
  return <details className={styles.notifications} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>Уведомления <ChevronDown size={18} aria-hidden="true" /></summary>
    {open && <div className={styles.channels}>
      <DeviceNotifications />
      {prefs.isPending ? <SonaLoader label="Загружаем настройки…" /> :
        prefs.isError ? <p role="alert">Настройки недоступны. <button onClick={() => prefs.refetch()}>Повторить</button></p> :
        categories.map(({key, label}) => <label key={key} className={styles.switchRow}>
          <span>{label}</span><input type="checkbox" role="switch" checked={prefs.data[key]} disabled={save.isPending}
            onChange={e => save.mutate({ [key]: e.currentTarget.checked })} />
        </label>)}
      <span role="status" className={styles.response}>{save.isPending ? "Сохраняем…" : save.isSuccess ? "Изменения сохранены" : ""}</span>
      {save.isError && <p role="alert">Не удалось сохранить. <button onClick={() => save.mutate(save.variables!)}>Повторить</button></p>}
    </div>}
  </details>;
}
