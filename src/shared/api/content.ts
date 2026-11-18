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
    super(
      messages[code] ??
        (status === 429
          ? "Слишком много запросов. Попробуйте позже."
          : status >= 500
            ? "Сервис временно недоступен. Попробуйте ещё раз."
            : "Не удалось выполнить запрос."),
    );
  }
}

const messages: Record<string, string> = {
  invalid_credentials: "Не удалось подтвердить данные для входа.",
  invalid_request: "Проверьте введённые данные.",
  attestation_required: "Сервис требует дополнительной проверки устройства. Попробуйте позже.",
  account_blocked: "Доступ к аккаунту ограничен.",
  rate_limited: "Слишком много попыток. Попробуйте позже.",
  unauthorized: "Срок сессии истёк. Войдите снова.",
  forbidden: "Для этого действия нужен аккаунт.",
  insufficient_coins: "Недостаточно монет.",
  locked: "Серия закрыта.",
  not_found: "Запись не найдена.",
  registration_required: "Для этого действия войдите в аккаунт.",
  timezone_change_too_soon: "Часовой пояс пока нельзя изменить. Проверьте дату следующей смены.",
  reauth_required: "Для удаления выйдите из аккаунта и снова войдите с паролем.",
  already_signed_in: "В этом браузере уже выполнен вход.",
  unavailable: "Сервис временно недоступен. Попробуйте позже.",
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
  const card = /^series\/[\w-]+$/.test(endpoint);
  const discovery = endpoint === "catalog" || endpoint === "search";
  const history = endpoint === "home" || endpoint === "me/continue-watching";
  if (typeof window !== "undefined" && (card || discovery || history)) {
    return observeContent(["content", contentPartition, endpoint, path], s => readContent<T>(path, s), history ? 10_000 : 30_000, signal);
  }
  return readContent<T>(path, signal);
}

async function readContent<T>(path: string, signal?: AbortSignal): Promise<T> {
  const read = () =>
    fetch(`/api/content/${path}`, {
      cache: "no-store",
      signal,
      headers: language ? { "Accept-Language": language } : undefined,
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
