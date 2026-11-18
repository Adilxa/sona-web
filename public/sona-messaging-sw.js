// This scope is reserved for push. It does not intercept page, API or video requests.
self.addEventListener("push", event => {
  if (!event.data) return;
  let message;
  try { message = event.data.json(); } catch { return; }
  if (!message || typeof message !== "object") return;
  const notification = message.notification || {};
  const data = message.data || {};
  const title = typeof notification.title === "string" ? notification.title : typeof data.title === "string" ? data.title : "";
  const body = typeof notification.body === "string" ? notification.body : typeof data.body === "string" ? data.body : "";
  if (!title && !body) return;
  const link = message.fcmOptions?.link || message.webpush?.fcm_options?.link || notification.click_action || data.link || data.url || data.deeplink || "/";
  event.waitUntil(self.registration.showNotification(title || "SONA", { body, data: { link: appLink(link) } }));
});

function appLink(value) {
  if (typeof value !== "string" || !value) return self.location.origin + "/";
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin === self.location.origin && !url.username && !url.password && !url.pathname.startsWith("/api/")) return url.href;
  } catch { /* Unknown destinations open the home page. */ }
  return self.location.origin + "/";
}

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = appLink(event.notification.data?.link);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => client.url === target);
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  })());
});

self.addEventListener("pushsubscriptionchange", event => {
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    windows.forEach(client => client.postMessage({ type: "sona-push-renew" }));
  }));
});
