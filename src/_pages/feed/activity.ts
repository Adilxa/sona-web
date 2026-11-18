import type { components } from "@/shared/api/schema";

export type FeedItem = components["schemas"]["FeedItem"];
type FeedEvent = components["schemas"]["EventInput"];
type Send = (events: FeedEvent[], keepalive: boolean) => Promise<unknown>;

// One visit starts when a card becomes visible and ends when another card takes its place.
export class FeedActivity {
  private queue: FeedEvent[] = [];
  private visit?: FeedItem;
  private started = false;
  private completed = false;
  private playingSince?: number;
  private watchedMs = 0;
  private reported = 0;
  private played: [number, number][] = [];
  private sending = false;
  private retryAt = 0;

  constructor(private send: Send, private now = () => performance.now()) {}

  show(item: FeedItem) {
    if (this.visit?.series_id === item.series_id) return;
    if (this.visit) {
      this.pause(this.visit.series_id);
      this.record("swipe_away", this.seconds());
    }
    this.visit = item;
    this.watchedMs = this.reported = 0;
    this.started = this.completed = false;
    this.played = [];
    this.record("impression");
  }

  play(id: number) {
    if (id !== this.visit?.series_id || this.playingSince !== undefined) return;
    this.playingSince = this.now();
    if (!this.started) this.record("play_start");
    this.started = true;
  }

  pause(id?: number) {
    if (!this.visit || (id !== undefined && this.visit.series_id !== id)) return;
    if (this.playingSince !== undefined) {
      this.watchedMs += Math.max(0, this.now() - this.playingSince);
      this.playingSince = undefined;
    }
    this.watchTime();
  }

  watchTime() {
    const seconds = this.seconds();
    if (seconds > this.reported) {
      this.record("watch_time", seconds - this.reported);
      this.reported = seconds;
    }
  }

  complete(id: number) {
    if (this.visit?.series_id !== id || !this.visit.first_episode_id || !this.started || this.completed) return;
    this.record("complete");
    this.completed = true;
  }

  observePlayback(id: number, video: Pick<HTMLVideoElement, "duration" | "played">, from: number, to: number) {
    if (this.visit?.series_id !== id || !this.started || this.completed) return;
    this.played = mergedPlayedRanges(this.played, video.played, from, to);
    if (Number.isFinite(video.duration) && video.duration > 0 &&
      this.played.reduce((seconds, [start, end]) => seconds + end - start, 0) >= .9 * video.duration) this.complete(id);
  }

  action(item: FeedItem, type: "like" | "share") {
    this.enqueue(item, type);
  }

  private record(type: FeedEvent["type"], value?: number) {
    if (this.visit) this.enqueue(this.visit, type, value);
  }

  private enqueue(item: FeedItem, type: FeedEvent["type"], value?: number) {
    this.queue.push({
      event_id: crypto.randomUUID(), type, occurred_at: new Date().toISOString(),
      series_id: item.series_id, episode_id: item.first_episode_id,
      ...(value !== undefined && { value: Math.min(86400, value) }),
    });
  }

  async flush(keepalive = false) {
    if (this.sending || Date.now() < this.retryAt) return;
    this.sending = true;
    try {
      while (this.queue.length) {
        const batch = this.queue.slice(0, 100);
        await this.send(batch, keepalive);
        this.queue.splice(0, batch.length);
      }
    } catch (error) {
      const retryAfter = Number((error as { retryAfter?: number })?.retryAfter) || 5;
      this.retryAt = Date.now() + Math.max(1, retryAfter) * 1000;
    } finally {
      this.sending = false;
    }
  }

  private seconds() {
    const current = this.playingSince === undefined ? 0 : Math.max(0, this.now() - this.playingSince);
    return Math.floor((this.watchedMs + current) / 1000);
  }
}

// The browser's cumulative played ranges also include background playback.
function mergedPlayedRanges(previous: [number, number][], current: TimeRanges, from: number, to: number) {
  if (to <= from) return previous;
  const ranges = [...previous];
  for (let i = 0; i < current.length; i++) {
    const start = Math.max(from, current.start(i));
    const end = Math.min(to, current.end(i));
    if (start < end) ranges.push([start, end]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const result: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = result.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else result.push([start, end]);
  }
  return result;
}
