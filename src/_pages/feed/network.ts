import { useSyncExternalStore } from "react";

type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };

function connection() {
  return (navigator as Navigator & { connection?: Connection }).connection;
}

function subscribe(update: () => void) {
  const network = connection();
  const preference = window.matchMedia("(prefers-reduced-data: reduce)");
  document.addEventListener("visibilitychange", update);
  network?.addEventListener("change", update);
  preference.addEventListener("change", update);
  return () => {
    document.removeEventListener("visibilitychange", update);
    network?.removeEventListener("change", update);
    preference.removeEventListener("change", update);
  };
}

function snapshot() {
  if (document.hidden) return "hidden";
  const network = connection();
  if (network?.saveData || network?.effectiveType === "slow-2g" || network?.effectiveType === "2g"
    || window.matchMedia("(prefers-reduced-data: reduce)").matches) return "manual";
  return "auto";
}

export function useFeedNetwork() {
  return useSyncExternalStore(subscribe, snapshot, () => "hidden" as const);
}

export function retainFeedVideo(network: ReturnType<typeof useFeedNetwork>, requested: boolean, attached: boolean) {
  if (network === "hidden") return attached;
  return network === "auto" || requested;
}

export async function waitForFeedVisibility(signal: AbortSignal) {
  signal.throwIfAborted();
  if (!document.hidden) return;
  await new Promise<void>((resolve, reject) => {
    function cleanup() {
      document.removeEventListener("visibilitychange", visible);
      signal.removeEventListener("abort", aborted);
    }
    function visible() {
      if (document.hidden) return;
      cleanup();
      resolve();
    }
    function aborted() {
      cleanup();
      reject(signal.reason);
    }
    document.addEventListener("visibilitychange", visible);
    signal.addEventListener("abort", aborted, { once: true });
  });
}
