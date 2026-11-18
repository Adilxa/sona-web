import { QueryClient, QueryObserver, type QueryObserverResult } from "@tanstack/react-query";

function createClient() {
  return new QueryClient({ defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  } });
}

let browserClient: QueryClient | undefined;
export function getSonaQueryClient() {
  if (typeof window === "undefined") return createClient();
  return browserClient ??= createClient();
}

// Imperative consumers (e.g. an intersection observer loading posters) share the same
// cache as React. Each reader releases its observer independently when leaving the screen.
export function observeContent<T>(
  queryKey: readonly unknown[],
  read: (signal: AbortSignal) => Promise<T>,
  staleTime: number,
  signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted();
  const observer = new QueryObserver<T>(getSonaQueryClient(), {
    queryKey, queryFn: ({ signal }) => read(signal), staleTime, networkMode: "always",
  });
  return new Promise((resolve, reject) => {
    let finished = false;
    function release() {
      signal?.removeEventListener("abort", abort);
      observer.destroy();
      finished = true;
    }
    function abort() {
      release();
      reject(signal?.reason);
    }
    function settle(result: QueryObserverResult<T>) {
      if (finished || result.fetchStatus !== "idle") return;
      if (result.isError) { release(); reject(result.error); }
      else if (result.isSuccess) { release(); resolve(result.data); }
    }
    signal?.addEventListener("abort", abort, { once: true });
    observer.subscribe(settle);
    settle(observer.getCurrentResult());
  });
}
