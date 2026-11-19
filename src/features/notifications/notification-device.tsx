"use client";

import { useI18n } from "@/shared/i18n/context";
import { Button as AnimatedButton } from "@animate-ui/react/primitives/buttons/button";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useSession } from "@/entities/session";
import { SonaLoader } from "@/shared/ui/sona-loader";
import { Button } from "@/shared/ui/button";
import { chooseDevicePush, clearDeviceView, devicePushAvailable, deviceState, pushPreferenceKey, retryDevicePush, serverDeviceState, subscribeDeviceState, syncDevicePush } from "./device-push";

export function DeviceNotificationSync() {
  const { me } = useSession();
  const viewer = me?.role === "user" ? me.id : undefined;
  const locale = me?.locale;
  useEffect(() => {
    if (!viewer || !devicePushAvailable()) { clearDeviceView(); return; }
    let mounted = true;
    let permission: PermissionStatus | undefined;
    const sync = () => { if (document.visibilityState !== "hidden") void syncDevicePush(viewer, locale); };
    const permissionChanged = () => { void syncDevicePush(viewer, locale, true); };
    const stored = (event: StorageEvent) => { if (event.key === pushPreferenceKey) permissionChanged(); };
    const workerMessage = (event: MessageEvent) => {
      if (event.data?.type === "sona-push-renew") permissionChanged();
    };
    void syncDevicePush(viewer, locale, true);
    navigator.permissions?.query({ name: "notifications" }).then(result => {
      if (mounted) { permission = result; permission.addEventListener("change", permissionChanged); }
    }).catch(() => {});
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("online", sync);
    window.addEventListener("storage", stored);
    navigator.serviceWorker.addEventListener("message", workerMessage);
    return () => {
      mounted = false;
      permission?.removeEventListener("change", permissionChanged);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("online", sync);
      window.removeEventListener("storage", stored);
      navigator.serviceWorker.removeEventListener("message", workerMessage);
    };
  }, [viewer, locale]);
  return null;
}

const errorMessages = {
  blocked: ["Уведомления заблокированы в настройках браузера.", "Notifications are blocked in your browser settings."],
  permission: ["Разрешение на уведомления не выдано.", "Permission to send notifications was not granted."],
  sync: ["Не удалось обновить уведомления на этом устройстве.", "Couldn’t refresh notifications on this device."],
  update: ["Не удалось изменить разрешение на уведомления.", "Couldn’t update notification permissions."],
} as const;

export function DeviceNotifications() {
  const { t } = useI18n();
  const { me } = useSession();
  const state = useSyncExternalStore(subscribeDeviceState, deviceState, serverDeviceState);
  const [available, setAvailable] = useState(false);
  useEffect(() => { setAvailable(devicePushAvailable()); }, []);
  if (!available || !me || me.role !== "user") return null;
  const current = state.viewer === me.id ? state.status : "off";
  const working = current === "working";
  const enabled = current === "on";
  const blocked = Notification.permission === "denied";
  const feedback = errorMessages[state.error ?? "sync"];
  return <div>
    <h3>{t("Уведомления в этом браузере", "Notifications in this browser")}</h3>
    {blocked && <p>{t("Чтобы получать уведомления, разрешите их в настройках сайта в браузере.", "Allow notifications in your browser’s site settings to receive updates.")}</p>}
    {current === "error" && <p role="alert">{t(feedback[0], feedback[1])}</p>}
    <AnimatedButton asChild><Button variant="outline" type="button" disabled={working || (blocked && current !== "error")} aria-pressed={enabled} aria-busy={working || undefined}
      onClick={() => {
        if (current === "error") void retryDevicePush(me.id, me.locale);
        else void chooseDevicePush(me.id, me.locale, !enabled);
      }}>
      {working ? <SonaLoader label={t("Обновляем…", "Updating…")} /> : current === "error" ? t("Повторить", "Try again") : enabled ? t("Отключить на устройстве", "Turn off on this device") : t("Включить на устройстве", "Turn on on this device")}
    </Button></AnimatedButton>
  </div>;
}
