"use client";

import { useLayoutEffect, useRef, type MouseEvent, type PointerEvent, type TransitionEvent } from "react";
import { episodeSwipe, reelDirection, reelOffset, releaseVelocity } from "./player-gesture";

type Sample = { y: number; time: number };
type Drag = {
  id: number; x: number; y: number; time: number; height: number;
  axis?: "vertical" | "horizontal"; samples: Sample[];
};
type Touch = PointerEvent<HTMLDivElement>;

export function useReelSwipe(mobile: boolean, episode: number | undefined, previous: number | undefined,
  next: number | undefined, advance: (episode: number) => void, onDrag: () => void) {
  const screen = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const settlement = useRef<{ timer: ReturnType<typeof setTimeout>; finish: () => void } | null>(null);

  function reset() {
    if (settlement.current) clearTimeout(settlement.current.timer);
    settlement.current = null;
    drag.current = null;
    if (screen.current) delete screen.current.dataset.motion;
    if (track.current) { track.current.style.transition = "none"; track.current.style.transform = ""; }
  }

  useLayoutEffect(() => {
    reset();
    const visibility = () => { if (document.hidden) reset(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { reset(); document.removeEventListener("visibilitychange", visibility); };
  }, [episode, mobile]);

  function settle(target?: number, destination = 0) {
    const layer = track.current;
    if (!screen.current || !layer) return;
    screen.current.dataset.motion = "settling";
    const finish = () => {
      if (settlement.current) clearTimeout(settlement.current.timer);
      settlement.current = null;
      if (target === undefined) reset();
      else advance(target); // The layout effect recenters on the new episode before the next paint.
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
    layer.style.transition = "transform 210ms cubic-bezier(.18,.78,.22,1)";
    layer.style.transform = `translate3d(0,${destination}px,0)`;
    settlement.current = { timer: setTimeout(finish, 240), finish };
  }

  function pointerDown(event: Touch) {
    if (screen.current?.dataset.motion === "settling" || !episode || (!previous && !next) || event.pointerType === "mouse") return;
    if (!event.isPrimary) { if (drag.current?.axis === "vertical" && mobile) settle(); drag.current = null; return; }
    suppressClick.current = false;
    if ((event.target as Element).closest("input,select,dialog")) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp,
      height: event.currentTarget.getBoundingClientRect().height || window.innerHeight,
      samples: [{ y: event.clientY, time: event.timeStamp }] };
  }

  function pointerMove(event: Touch) {
    const start = drag.current;
    if (!mobile || !start || start.id !== event.pointerId) return;
    const dy = event.clientY - start.y;
    const dx = event.clientX - start.x;
    if (!start.axis && Math.max(Math.abs(dx),Math.abs(dy)) >= 7) {
      start.axis = Math.abs(dy) > Math.abs(dx) * 1.15 ? "vertical" : "horizontal";
      if (start.axis === "vertical") {
        onDrag();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.currentTarget.dataset.motion = "dragging";
      }
    }
    if (start.axis !== "vertical") return;
    start.samples = start.samples.filter(point => event.timeStamp - point.time <= 110);
    start.samples.push({ y: event.clientY, time: event.timeStamp });
    if (track.current) track.current.style.transform = `translate3d(0,${reelOffset(dy,start.height,!!previous,!!next)}px,0)`;
  }

  function pointerUp(event: Touch) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    const distance = event.clientY - start.y;
    const dx = event.clientX - start.x;
    suppressClick.current = Math.hypot(distance,dx) > 16;
    if (start.axis === "horizontal" || (!start.axis && Math.abs(distance) <= Math.max(7,Math.abs(dx) * 1.15))) return;
    let direction: -1 | 0 | 1;
    if (mobile) {
      const velocity = releaseVelocity(start.samples,{ y: event.clientY, time: event.timeStamp });
      direction = reelDirection(distance,start.height,velocity);
    } else {
      direction = episodeSwipe(start,{ x: event.clientX, y: event.clientY, time: event.timeStamp });
    }
    const target = direction === 1 ? next : direction === -1 ? previous : undefined;
    if (mobile) settle(target,target ? -direction * start.height : 0);
    else if (target) advance(target);
  }

  function pointerCancel(event: Touch) {
    if (!drag.current || event.pointerId !== drag.current.id) return;
    if (mobile && drag.current.axis === "vertical") settle();
    drag.current = null;
  }

  return { screen, track, gestures: {
    onPointerDownCapture: pointerDown, onPointerMoveCapture: pointerMove,
    onPointerUpCapture: pointerUp, onPointerCancel: pointerCancel,
    onClickCapture(event: MouseEvent<HTMLDivElement>) {
      if ((settlement.current || suppressClick.current) && event.detail !== 0) {
        suppressClick.current = false; event.preventDefault(); event.stopPropagation();
      }
    },
  }, finishMotion(event: TransitionEvent<HTMLDivElement>) {
    if (event.target === track.current && event.propertyName === "transform") settlement.current?.finish();
  } };
}
