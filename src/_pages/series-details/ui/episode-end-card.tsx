"use client";

import { Button } from "@animate-ui/react/primitives/buttons/button";
import { LockKeyhole, Play, RotateCcw } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { PlaybackCountdown } from "./playback-countdown";
import styles from "./details.module.css";

type Props = {
  next?: { number: number; locked: boolean };
  completedSeries: boolean;
  sheetOpen: boolean;
  swiped: boolean;
  onNext: () => void;
  onReplay: () => void;
};

export function EpisodeEndCard({ next, completedSeries, sheetOpen, swiped, onNext, onReplay }: Props) {
  const [clock] = useState(() => new PlaybackCountdown());
  const [seconds, setSeconds] = useState(10);
  const [cancelled, setCancelled] = useState(false);
  const stopAutomatic = useRef(false);
  const auto = next?.locked === false && !cancelled && !swiped;
  const advance = () => { if (clock.claim()) onNext(); };
  const expire = useEffectEvent(() => {
    if (auto && !stopAutomatic.current && !document.hidden && !sheetOpen) advance();
  });

  useEffect(() => {
    if (!auto || sheetOpen) return;
    let tick: number | undefined;
    function pause() {
      window.clearTimeout(tick);
      clock.pause(performance.now());
    }
    function update() {
      window.clearTimeout(tick);
      if (document.hidden) { pause(); return; }
      const now = performance.now();
      clock.resume(now);
      const left = clock.left(now);
      setSeconds(Math.ceil(left / 1000));
      if (!left) { expire(); return; }
      tick = window.setTimeout(update,left % 1000 || 1000);
    }
    update();
    document.addEventListener("visibilitychange",update);
    window.addEventListener("pagehide",pause);
    window.addEventListener("pageshow",update);
    return () => {
      pause();
      document.removeEventListener("visibilitychange",update);
      window.removeEventListener("pagehide",pause);
      window.removeEventListener("pageshow",update);
    };
  },[auto,sheetOpen,clock]);

  function cancel() {
    stopAutomatic.current = true;
    setCancelled(true);
  }

  function replay() {
    if (clock.hasAdvanced) return;
    cancel();
    onReplay();
  }

  return <section className={styles.endCard} aria-label="После серии">
    <div className={styles.endHeading}>
      <strong>{next ? `Далее · серия ${next.number}` : completedSeries ? "Вы досмотрели сериал" : "Пока это последняя серия"}</strong>
      {next && <Button className={styles.repeatIcon} aria-label="Повторить серию" onClick={replay}><RotateCcw size={17} /></Button>}
    </div>
    {next && auto && <span role="timer" className={styles.timer}>Начнётся через {seconds} с</span>}
    {next?.locked && <span className={styles.timer}><LockKeyhole size={14} /> Серия закрыта</span>}
    <div className={styles.endActions}>
      {next ? <>
        <Button className={styles.endPrimary} onClick={advance}>
          {next.locked ? <LockKeyhole size={15} /> : <Play size={15} fill="currentColor" />}
          {next.locked ? "Варианты доступа" : "Смотреть сейчас"}
        </Button>
        {auto && <Button className={styles.cancelNext} onClick={cancel}>Отмена</Button>}
      </> : <Button className={styles.endPrimary} onClick={replay}><RotateCcw size={15} /> Повторить серию</Button>}
    </div>
  </section>;
}
