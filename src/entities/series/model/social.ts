"use client";

import { skipToken, useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { changeContent, getContent } from "@/shared/api/content";
import type { components } from "@/shared/api/schema";

type FavoritesPage = components["schemas"]["FavoritesPage"];
type SocialKind = "favorite" | "like";

export const favoritesKey = (viewer?: string) => ["series-social", viewer, "favorites"] as const;
const likeKey = (viewer: string | undefined, series: string) => ["series-social", viewer, "like", series] as const;

export function useSeriesFavorites(viewer?: string) {
  return useQuery({
    queryKey: favoritesKey(viewer),
    enabled: Boolean(viewer),
    staleTime: 60_000,
    retry: false,
    networkMode: "always",
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const ids = new Set<string>();
      const cursors = new Set<string>();
      let cursor = "";
      do {
        const path = "me/favorites" + (cursor ? "?" + new URLSearchParams({ cursor }) : "");
        const page = await getContent<FavoritesPage>(path, signal);
        page.items.forEach(item => ids.add(String(item.series_id)));
        if (!page.page.has_more) break;
        cursor = page.page.next_cursor ?? "";
        if (!cursor || cursors.has(cursor)) throw Error("Не удалось загрузить следующую страницу избранного.");
        cursors.add(cursor);
      } while (cursor);
      return [...ids];
    },
  });
}

// The API has PUT/DELETE for likes, but no read operation. Only confirmed writes can set this value.
export function useConfirmedLike(viewer: string | undefined, series: string) {
  return useQuery<boolean>({ queryKey: likeKey(viewer, series), queryFn: skipToken, gcTime: Infinity }).data;
}

export function useSeriesSocialWrite(kind: SocialKind, viewer: string | undefined, series: string, onConfirmed?: (target: boolean) => void) {
  const client = useQueryClient();
  const key = ["series-social", viewer, "write", kind, series] as const;
  const filters = { mutationKey: key, exact: true };
  const states = useMutationState({
    filters,
    select: mutation => mutation.state,
  });
  const latest = states.at(-1);
  const { mutate } = useMutation({
    mutationKey: key,
    retry: false,
    networkMode: "always",
    mutationFn: (target: boolean) => changeContent(`series/${encodeURIComponent(series)}/${kind}`, target ? "PUT" : "DELETE"),
    onSuccess: async (_, target) => {
      if (kind === "like") {
        client.setQueryData(likeKey(viewer, series), target);
        onConfirmed?.(target);
        return;
      }
      const queryKey = favoritesKey(viewer);
      await client.cancelQueries({ queryKey, exact: true });
      client.setQueryData<string[]>(queryKey, previous => {
        if (!previous) return previous;
        return target ? [series, ...previous.filter(id => id !== series)] : previous.filter(id => id !== series);
      });
      void client.invalidateQueries({ queryKey, exact: true });
    },
  });
  return {
    pending: latest?.status === "pending",
    failed: latest?.status === "error",
    error: latest?.error instanceof Error ? latest.error.message : undefined,
    write(target: boolean) {
      // Simultaneously mounted copies of one poster may receive clicks in the same React batch.
      if (!viewer || client.isMutating(filters) > 0) return;
      mutate(latest?.status === "error" && typeof latest.variables === "boolean" ? latest.variables : target);
    },
  };
}
