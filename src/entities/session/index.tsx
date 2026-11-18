"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ensureSession, getContent, requireSuccess, setContentIdentity } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";

type Me = components["schemas"]["Me"];
type Account = { me?: Me; error: string; reload: () => void };
const Context = createContext<Account>({ error: "", reload() {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => {
    setContentIdentity();
    setMe(undefined);
    setError("");
    setVersion((v) => v + 1);
  }, []);
  useEffect(() => {
    const channel = new BroadcastChannel("sona-identity");
    channel.onmessage = reload;
    window.addEventListener("sona-identity", reload);
    return () => {
      channel.close();
      window.removeEventListener("sona-identity", reload);
    };
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController();
    getContent<Me>("me", controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setContentIdentity(value);
          setMe(value);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [version]);
  return <Context.Provider value={{ me, error, reload }}>{children}</Context.Provider>;
}

export const useSession = () => useContext(Context);

export async function authenticate(
  action: "email/request" | "email/verify" | "email/login" | "email/link" | "logout" | "delete-account",
  body?: unknown,
) {
  return navigator.locks.request("sona-session", async () => {
    if (action !== "email/request") await ensureSession();
    if (action === "logout" || action === "delete-account") {
      // Use the current session before it is revoked. A failed push cleanup must not prevent sign-out.
      try {
        await fetch("/api/content/me/push-token", { method: "DELETE", signal: AbortSignal.timeout(1200) });
      } catch { /* Revoke the session even if the push endpoint is unavailable. */ }
    }
    const response = await requireSuccess(
      await fetch(`/api/session/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    if (action.endsWith("/request")) return;
    const result = action !== "logout" ? await response.json() : undefined;
    if (action === "delete-account" && result?.deletion_scheduled_at)
      sessionStorage.setItem("sona-deleted", result.deletion_scheduled_at);
    if (result?.deletion_cancelled) sessionStorage.setItem("sona-restored", "true");
    window.dispatchEvent(new Event("sona-identity"));
    const channel = new BroadcastChannel("sona-identity");
    channel.postMessage("changed");
    channel.close();
    return result;
  });
}
