"use client";

import { requireSuccess } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
export const pushPreferenceKey = "sona-notifications-device";
type Status = "off" | "on" | "working" | "error";
type DeviceState = { viewer: string; status: Status; error?: string };
const initialState: DeviceState = { viewer: "", status: "off" };
let state = initialState;
const subscribers = new Set<() => void>();
let request: { key: string; promise: Promise<void> } | undefined;
let generation = 0;
let lastSync: { key: string; at: number } | undefined;

export function devicePushAvailable() {
  return Boolean(vapidKey && Object.values(firebaseConfig).every(Boolean) && typeof window !== "undefined"
    && window.isSecureContext && "Notification" in window && "serviceWorker" in navigator
    && "PushManager" in window && "indexedDB" in window && navigator.locks);
}
export function subscribeDeviceState(fn: () => void) {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}
export const deviceState = () => state;
export const serverDeviceState = () => initialState;
function publish(next: DeviceState) {
  state = next;
  subscribers.forEach(fn => fn());
}
function preference() {
  try { return localStorage.getItem(pushPreferenceKey); } catch { return null; }
}

async function activeWorker() {
  const registration = await navigator.serviceWorker.register("/sona-messaging-sw.js", { scope: "/sona-push/" });
  if (registration.active?.state === "activated") return registration;
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) throw Error("Не удалось запустить службу уведомлений.");
  await new Promise<void>((resolve, reject) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", check);
      if (ok) resolve(); else reject(Error("Служба уведомлений пока не готова."));
    };
    const check = () => {
      if (worker.state === "activated") done(true);
      else if (worker.state === "redundant") done(false);
    };
    const timer = setTimeout(() => done(false), 10_000);
    worker.addEventListener("statechange", check);
    check();
  });
  return registration;
}

async function registrationToken() {
  const [appSdk, sdk] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  if (!await sdk.isSupported()) throw Error("Этот браузер не поддерживает веб-уведомления.");
  const name = "sona-web-push";
  const app = appSdk.getApps().find(value => value.name === name) ?? appSdk.initializeApp(firebaseConfig, name);
  const worker = await activeWorker();
  if (Notification.permission !== "granted") throw Error("Разрешите уведомления в настройках браузера.");
  // Sona accepts the FCM registration token, not the shorter Firebase Installation ID.
  return sdk.getToken(sdk.getMessaging(app), { vapidKey, serviceWorkerRegistration: worker });
}

// Keep only the identity check and BFF write inside the auth lock. Provider calls may take time.
export async function bindDevicePush(viewer: string, body: components["schemas"]["PushTokenRequest"] | undefined, current: () => boolean) {
  return navigator.locks.request("sona-session", async () => {
    if (!current()) return false;
    const signal = AbortSignal.timeout(3500);
    const account = await requireSuccess(await fetch("/api/content/me", { cache: "no-store", signal }));
    const me: components["schemas"]["Me"] = await account.json();
    if (!current() || me.role !== "user" || me.id !== viewer) return false;
    await requireSuccess(await fetch("/api/content/me/push-token", {
      method: body ? "PUT" : "DELETE", signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }));
    return true;
  });
}

export function clearDeviceView() {
  generation++;
  request = undefined;
  lastSync = undefined;
  if (state !== initialState) publish(initialState);
}

export function syncDevicePush(viewer: string, locale?: string | null, force = false): Promise<void> {
  if (!devicePushAvailable()) return Promise.resolve();
  const choice = preference();
  const enabled = choice !== "off" && Notification.permission === "granted";
  if (!enabled && choice !== "on" && choice !== "off") {
    clearDeviceView();
    return Promise.resolve();
  }
  const key = JSON.stringify([viewer, locale, enabled]);
  if (request?.key === key) return request.promise;
  if (!force && lastSync?.key === key && Date.now() - lastSync.at < 6 * 60 * 60 * 1000) return Promise.resolve();
  const run = ++generation;
  const current = () => run === generation && (preference() !== "off" && Notification.permission === "granted") === enabled;
  publish({ viewer, status: "working" });
  const promise = (async () => {
    try {
      const token = enabled ? await registrationToken() : undefined;
      if (enabled && !token) throw Error("Firebase не вернул токен устройства.");
      const language = locale || navigator.language;
      const body = token ? {
        provider: "fcm" as const, token,
        locale: language && language.length <= 35 && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language) ? language : undefined,
      } : undefined;
      if (!await bindDevicePush(viewer, body, current) || !current()) {
        if (run === generation) publish({ viewer, status: "off" });
        return;
      }
      if (enabled && choice === null) { try { localStorage.setItem(pushPreferenceKey, "on"); } catch { /* Permission still applies for this visit. */ } }
      lastSync = { key, at: Date.now() };
      publish({ viewer, status: enabled ? "on" : "off" });
    } catch {
      if (run === generation) publish({ viewer, status: "error", error: "Не удалось обновить уведомления на этом устройстве." });
    } finally {
      if (run === generation) request = undefined;
    }
  })();
  request = { key, promise };
  return promise;
}

export async function chooseDevicePush(viewer: string, locale: string | null | undefined, enabled: boolean) {
  try {
    if (enabled) {
      // Call in the click handler before loading any SDK to preserve browser user activation.
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        publish({ viewer, status: "error", error: permission === "denied" ? "Уведомления заблокированы в настройках браузера." : "Разрешение на уведомления не выдано." });
        return;
      }
    }
    localStorage.setItem(pushPreferenceKey, enabled ? "on" : "off");
    await syncDevicePush(viewer, locale, true);
  } catch {
    publish({ viewer, status: "error", error: "Не удалось изменить разрешение на уведомления." });
  }
}

export function retryDevicePush(viewer: string, locale?: string | null) {
  return preference() === "off" || Notification.permission === "granted"
    ? syncDevicePush(viewer, locale, true)
    : chooseDevicePush(viewer, locale, true);
}
