import type { HlsConfig, LoaderCallbacks, LoaderConfiguration, LoaderContext } from "hls.js";
import type { components } from "@/shared/api/schema";

type Stream = components["schemas"]["Playback"];
type Access = (episodeId: string, signal?: AbortSignal) => Promise<Stream>;
export type NetworkInfo = { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
type Transfer = { firstByteMs: number; durationMs: number };
type WarmResource = Transfer & { data: string | ArrayBuffer };
export type WarmEpisode = { stream: Stream; resources: Map<string, WarmResource> };
const playlistLimit = 64 * 1024;
const segmentLimit = 768 * 1024;

export function fastConnection(connection?: NetworkInfo) {
  return Boolean(connection && !connection.saveData && connection.effectiveType === "4g" &&
    Number.isFinite(connection.downlink) && connection.downlink! >= 5 &&
    Number.isFinite(connection.rtt) && connection.rtt! > 0 && connection.rtt! <= 150);
}

export function shouldWarm(connection: NetworkInfo | undefined, visible: boolean, video: Pick<HTMLVideoElement,
  "paused" | "ended" | "seeking" | "readyState" | "duration" | "currentTime" | "played" | "buffered">) {
  if (!visible || !fastConnection(connection) || video.paused || video.ended || video.seeking || video.readyState < 3) return false;
  const remaining = video.duration - video.currentTime;
  if (!Number.isFinite(remaining) || remaining < .5 || remaining > 25) return false;
  let played = 0;
  for (let i = 0; i < video.played.length; i++) played += video.played.end(i) - video.played.start(i);
  if (played < 3) return false;
  for (let i = 0; i < video.buffered.length; i++) {
    if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) - video.currentTime >= Math.min(8,remaining - .25)) return true;
  }
  return false;
}

function fresh(stream: Stream, now: number) {
  return Date.parse(stream.expires_at) > now + 15000;
}

// Read at most two small manifests and one complete, short media segment. Unsupported playlists just play normally.
async function read(url: string, limit: number, signal: AbortSignal, segment = false) {
  const start = performance.now();
  const response = await fetch(url, { signal, credentials: "omit", cache: "no-store", redirect: "error",
    priority: "low", headers: segment ? { Range: `bytes=0-${limit - 1}` } : undefined });
  const firstByteMs = performance.now() - start;
  const body = response.body;
  if (!body) throw Error();
  const partial = response.headers.get("Content-Range")?.match(/^bytes 0-(\d+)\/(\d+)$/i);
  if (!response.ok || Number(response.headers.get("Content-Length")) > limit ||
      (response.status === 206 && (!partial || Number(partial[1]) + 1 !== Number(partial[2]) || Number(partial[2]) > limit))) {
    await body.cancel();
    throw Error();
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw Error(); }
    chunks.push(value);
  }
  if (!length || (partial && length !== Number(partial[2]))) throw Error();
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return { bytes: data, timing: { firstByteMs, durationMs: performance.now() - start } };
}

function childURL(path: string, base: string) {
  if (!path || path.startsWith("#") || path.includes("{$")) return;
  const url = new URL(path,base);
  if (url.protocol === "https:" && url.origin === new URL(base).origin && !url.username && !url.password) return url.href;
}

async function warmOpening(entry: WarmEpisode, signal: AbortSignal) {
  let url = entry.stream.url;
  for (let depth = 0; depth < 2; depth++) {
    const manifest = await read(url,playlistLimit,signal);
    const text = new TextDecoder().decode(manifest.bytes);
    const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines[0] !== "#EXTM3U") return;
    const variants = lines.flatMap((line, i) => {
      if (!line.startsWith("#EXT-X-STREAM-INF:")) return [];
      const rate = Number(line.match(/(?:[:,])BANDWIDTH=(\d+)/)?.[1]);
      const child = childURL(lines[i + 1],url);
      return child && rate > 0 ? [{ child, rate }] : [];
    }).sort((a,b) => a.rate - b.rate);
    if (variants.length) {
      entry.resources.set(url,{ data: text, ...manifest.timing });
      url = variants[0].child;
      continue;
    }
    if (!lines.includes("#EXT-X-ENDLIST") || lines.some(line => /^#EXT-X-(?:BYTERANGE|GAP|PART:)/.test(line))) return;
    entry.resources.set(url,{ data: text, ...manifest.timing });
    const segments = lines.filter(line => !line.startsWith("#"));
    const duration = Number(lines.find(line => line.startsWith("#EXTINF:"))?.slice(8).split(",")[0]);
    if (new Set(segments).size < 2 || !(duration > 0 && duration <= 8)) return;
    const first = childURL(segments[0],url);
    if (first) {
      const segment = await read(first,segmentLimit,signal,true);
      entry.resources.set(first,{ data: segment.bytes.buffer, ...segment.timing });
    }
    return;
  }
}

export class NextEpisodeBuffer {
  private slot?: { id: number; series: number; controller?: AbortController; entry?: WarmEpisode };
  constructor(private access: Access, private now = Date.now) {}

  async prepare(series: number, id: number) {
    if (this.slot?.id === id && this.slot.series === series) return;
    this.clear();
    const controller = new AbortController();
    const slot: NonNullable<NextEpisodeBuffer["slot"]> = { id, series, controller };
    this.slot = slot;
    const timer = setTimeout(() => controller.abort(),8000);
    try {
      const stream = await this.access(String(id),controller.signal);
      if (controller.signal.aborted || stream.episode_id !== id || stream.series_id !== series ||
          !fresh(stream,this.now()) || new URL(stream.url).protocol !== "https:") return;
      slot.entry = { stream, resources: new Map() };
      await warmOpening(slot.entry,controller.signal);
    } catch {
      // A denied, expired, unsupported or throttled preview must never interrupt the current episode.
    } finally {
      clearTimeout(timer);
      slot.controller = undefined;
    }
  }

  cancelPending() {
    this.slot?.controller?.abort();
  }

  take(series: number, id: number) {
    const slot = this.slot;
    this.clear();
    if (slot?.series === series && slot.id === id && slot.entry && fresh(slot.entry.stream,this.now())) return slot.entry;
  }

  clear() {
    this.cancelPending();
    this.slot = undefined;
  }
}

// hls.js consumes the exact resources already fetched for this signed playback URL.
// All other renditions, ranges, keys and later segments go to its normal loader.
export function reuseOpening(Base: HlsConfig["loader"], entry: WarmEpisode) {
  return class extends Base {
    load(ctx: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>) {
      const cache = entry.resources.get(ctx.url);
      if (!cache || ctx.rangeEnd || ctx.rangeStart || !fresh(entry.stream,Date.now()) ||
          (ctx.responseType === "arraybuffer") !== (cache.data instanceof ArrayBuffer)) {
        super.load(ctx,config,callbacks);
        return;
      }
      entry.resources.delete(ctx.url);
      this.context = ctx;
      const stats = this.stats;
      const cached = cache.data;
      stats.loading.end = performance.now();
      stats.loading.start = Math.max(0,stats.loading.end - cache.durationMs);
      stats.loading.first = Math.min(stats.loading.end,stats.loading.start + cache.firstByteMs);
      stats.total = stats.loaded = typeof cached === "string" ? new TextEncoder().encode(cached).length : cached.byteLength;
      stats.bwEstimate = stats.total * 8000 / Math.max(1,cache.durationMs - cache.firstByteMs);
      queueMicrotask(() => {
        if (!this.context || this.stats.aborted) return;
        callbacks.onProgress?.(stats,ctx,cached,null);
        if (this.context && !this.stats.aborted) callbacks.onSuccess({ url: ctx.url, data: cached, code: 200 },stats,ctx,null);
      });
    }
    abort() { this.stats.aborted = true; super.abort(); }
  };
}
