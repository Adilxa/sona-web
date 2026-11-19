import { documentLocale, uiText } from "../i18n/model";
import { getSonaQueryClient, observeContent } from "./query-client";
import type { components } from "./schema";

let language: string | null | undefined;
let contentPartition = 0;
export function setContentIdentity(profile?: components["schemas"]["Me"]) {
  if (typeof window !== "undefined") getSonaQueryClient().clear();
  language = profile?.locale;
  contentPartition++;
}
export const getContentPartition = () => contentPartition;

export function installation(): components["schemas"]["SignInDevice"] {
  let id = localStorage.getItem("sona-device");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("sona-device", id);
  }
  return {
    device_id: id,
    platform: "web",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}

export class SonaError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfter: number,
    public requestId: string | null,
    public problem?: components["schemas"]["LockedProblem"],
  ) {
    const fallback = status === 429 ? messages.rate_limited : status >= 500 ? messages.unavailable : messages.unknown;
    super(uiText(...(messages[code] ?? fallback)));
  }
}

const messages: Record<string, [string, string]> = {
  invalid_credentials: ["Не удалось подтвердить данные для входа.", "We couldn't verify your sign-in details."],
  invalid_request: ["Проверьте введённые данные.", "Check the details you entered."],
  attestation_required: ["Сервис требует дополнительной проверки устройства. Попробуйте позже.", "Your device needs an additional check. Try again later."],
  account_blocked: ["Доступ к аккаунту ограничен.", "Access to this account is restricted."],
  rate_limited: ["Слишком много попыток. Попробуйте позже.", "Too many attempts. Try again later."],
  unauthorized: ["Срок сессии истёк. Войдите снова.", "Your session has expired. Sign in again."],
  forbidden: ["Для этого действия нужен аккаунт.", "You need an account for this action."],
  insufficient_coins: ["Недостаточно монет.", "You don't have enough coins."],
  locked: ["Серия закрыта.", "This episode is locked."],
  not_found: ["Запись не найдена.", "This item could not be found."],
  registration_required: ["Для этого действия войдите в аккаунт.", "Sign in to continue."],
  timezone_change_too_soon: ["Часовой пояс пока нельзя изменить. Проверьте дату следующей смены.", "Check when you can change your time zone again."],
  reauth_required: ["Для удаления выйдите из аккаунта и снова войдите с паролем.", "To delete your account, sign out and sign in again with your password."],
  already_signed_in: ["В этом браузере уже выполнен вход.", "You're already signed in on this browser."],
  unavailable: ["Сервис временно недоступен. Попробуйте ещё раз.", "The service is temporarily unavailable. Try again."],
  unknown: ["Не удалось выполнить запрос.", "The request couldn't be completed."],
};

export async function requireSuccess(response: Response) {
  if (response.ok) return response;
  const problem = await response.json().catch(() => null);
  throw new SonaError(
    response.status,
    problem?.code ?? "",
    Number(response.headers.get("Retry-After")) || 0,
    response.headers.get("X-Request-Id"),
    problem,
  );
}

async function renew() {
  const device = installation();
  await requireSuccess(
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: device.device_id, timezone: device.timezone, force: true }),
    }),
  );
}

// Call only under the same cross-tab lock used by sign-in and refresh rotation.
export async function ensureSession() {
  const probe = await fetch("/api/content/me", { cache: "no-store" });
  if (probe.status === 401) await renew();
  else await requireSuccess(probe);
}

export function getContent<T = unknown>(path: string, signal?: AbortSignal): Promise<T> {
  const endpoint = path.split("?")[0];
  const contentLanguage = language || documentLocale();
  const card = /^series\/[\w-]+$/.test(endpoint);
  const discovery = endpoint === "catalog" || endpoint === "search";
  const history = endpoint === "home" || endpoint === "me/continue-watching";
  if (typeof window !== "undefined" && (card || discovery || history)) {
    return observeContent(["content", contentPartition, endpoint, contentLanguage, path], s => readContent<T>(path, contentLanguage, s), history ? 10_000 : 30_000, signal);
  }
  return readContent<T>(path, contentLanguage, signal);
}

async function readContent<T>(path: string, contentLanguage: string, signal?: AbortSignal): Promise<T> {
  const read = () =>
    fetch(`/api/content/${path}`, {
      cache: "no-store",
      signal,
      headers: { "Accept-Language": contentLanguage },
    });
  let response = await read();
  if (response.status === 401) {
    await navigator.locks.request("sona-session", async () => {
      response = await read();
      if (response.status !== 401) return;
      // A user-only endpoint can also return 401 to a valid guest.
      if (path === "me") await renew();
      else await ensureSession();
      response = await read();
    });
  }
  return (await requireSuccess(response)).json();
}

export async function changeContent(
  path: string,
  method: "POST" | "PUT" | "DELETE" | "PATCH",
  body?: unknown,
  intent?: string,
) {
  const headers = new Headers();
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (intent) headers.set("Idempotency-Key", intent);
  const send = () => fetch(`/api/content/${path}`, { method, headers, body: JSON.stringify(body) });
  let response = await send();
  if (response.status === 401) {
    await navigator.locks.request("sona-session", async () => {
      await ensureSession();
      response = await send();
    });
  }
  const success = await requireSuccess(response);
  if (path === "progress" && typeof window !== "undefined") {
    const client = getSonaQueryClient();
    for (const key of ["home", "me/continue-watching"]) {
      void client.invalidateQueries({ queryKey: ["content", contentPartition, key], refetchType: "none" });
    }
  }
  return success;
}
