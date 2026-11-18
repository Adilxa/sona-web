// Counts foreground time only. Claiming the transition is synchronous across tap and timer callbacks.
export class PlaybackCountdown {
  private remaining = 10_000;
  private startedAt?: number;
  private claimed = false;

  resume(now: number) {
    if (this.startedAt === undefined) this.startedAt = now;
  }

  left(now: number) {
    return Math.max(0,this.remaining - (this.startedAt === undefined ? 0 : Math.max(0,now - this.startedAt)));
  }

  pause(now: number) {
    this.remaining = this.left(now);
    this.startedAt = undefined;
  }

  get hasAdvanced() { return this.claimed; }

  claim() {
    if (this.claimed) return false;
    this.claimed = true;
    return true;
  }
}
