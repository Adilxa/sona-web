type Point = { x: number; y: number; time: number };

export function episodeSwipe(start: Point, end: Point): -1 | 0 | 1 {
  const vertical = end.y - start.y;
  const horizontal = end.x - start.x;
  const elapsed = end.time - start.time;
  if (elapsed < 0 || elapsed > 800 || Math.abs(vertical) < 54 || Math.abs(vertical) < Math.abs(horizontal) * 1.6) return 0;
  return vertical < 0 ? 1 : -1;
}

export function mediaTime(seconds: number) {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function reelOffset(distance: number, height: number, hasPrevious: boolean, hasNext: boolean) {
  const size = Math.max(1, height);
  if ((distance > 0 && !hasPrevious) || (distance < 0 && !hasNext)) {
    // The rubber band grows progressively firmer at the start and end of the series.
    const limit = size * .15;
    return Math.sign(distance) * limit * (1 - Math.exp(-Math.abs(distance) / (limit * 2)));
  }
  return Math.max(-size, Math.min(size, distance));
}

type MotionSample = { y: number; time: number };

export function releaseVelocity(samples: MotionSample[], end: MotionSample) {
  // Measure the final stroke. A quick reversal can undo a long drag before the user lets go.
  let from = end;
  let sign = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    const sample = samples[i];
    if (end.time - sample.time > 110) break;
    const delta = from.y - sample.y;
    if (Math.abs(delta) < 2) continue;
    if (sign && Math.sign(delta) !== sign) break;
    sign = Math.sign(delta);
    from = sample;
  }
  return (end.y - from.y) / Math.max(12,end.time - from.time);
}

export function reelDirection(distance: number, height: number, velocity: number, accessWall = false): -1 | 0 | 1 {
  const length = Math.abs(distance);
  if (height <= 0 || length < 22) return 0;
  const speedAlongDrag = velocity * Math.sign(distance);
  if (speedAlongDrag < -.3) return 0;
  // The access card leaves less room to drag than a full-screen video.
  const travel = accessWall ? Math.min(96, height * .31) : height * .31;
  if (length < travel && speedAlongDrag < .56) return 0;
  return distance < 0 ? 1 : -1;
}

export function wallScrollEdge(panel: Pick<HTMLElement, "clientHeight" | "scrollHeight" | "scrollTop">) {
  const limit = panel.scrollHeight - panel.clientHeight;
  if (limit <= 1) return "none";
  if (panel.scrollTop <= 1) return "top";
  if (panel.scrollTop >= limit - 1) return "bottom";
  return "middle";
}

export function wallCanScroll(edge: ReturnType<typeof wallScrollEdge> | undefined, fingerTravel: number) {
  return edge === "middle" || (edge === "top" && fingerTravel < 0) || (edge === "bottom" && fingerTravel > 0);
}
