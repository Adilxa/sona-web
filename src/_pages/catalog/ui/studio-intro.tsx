"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ToggleGroup } from "radix-ui";
import { ArrowDown, Play } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/shared/ui/button";
import { useViewingMood } from "@/features/viewing-mood/context";
import { isViewingMood, moodCopy, moodOptions, moods, type ViewingMood } from "@/features/viewing-mood/model";
import { useI18n } from "@/shared/i18n/context";
import { localizedPath } from "@/shared/seo/urls";
import styles from "./studio-intro.module.css";

const compactQuery = "(max-width: 760px), (max-height: 550px) and (orientation: landscape) and (hover: none) and (pointer: coarse)";
function subscribeToLayout(changed: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener("change", changed);
  return () => media.removeEventListener("change", changed);
}
const compactLayout = () => window.matchMedia(compactQuery).matches;
const initialCompactLayout = () => true;

export function ScreeningRoom() {
  const { mood, choose, restored } = useViewingMood();
  const { locale, t } = useI18n();
  const compact = useSyncExternalStore(subscribeToLayout, compactLayout, initialCompactLayout);
  const [decoded, setDecoded] = useState<ViewingMood[]>([]);
  const [previous, setPrevious] = useState<ViewingMood>();
  const projected = decoded.includes(mood) ? mood : previous;
  useEffect(() => { if (decoded.includes(mood)) setPrevious(mood); }, [mood, decoded]);
  const section = useRef<HTMLElement>(null);
  const camera = useRef<HTMLDivElement>(null);
  const type = useRef<HTMLDivElement>(null);
  const reflection = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const preference = window.matchMedia("(min-width: 761px) and (prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)");
    const network = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (network?.saveData) return;
    let disposed = false;
    let release: (() => void) | undefined;
    async function enable() {
      if (!preference.matches) return;
      preference.removeEventListener("change", enable);
      const { gsap } = await import("gsap");
      const scene = section.current, room = type.current, lens = camera.current, light = reflection.current;
      if (disposed || !scene || !room || !lens || !light) return;
      const media = gsap.matchMedia();
      media.add(preference.media, () => {
        gsap.from(room, { scale: 1.07, duration: 1.05, ease: "power3.out" });
        const tiltX = gsap.quickTo(room, "rotationX", { duration: .6, ease: "power3.out" });
        const tiltY = gsap.quickTo(room, "rotationY", { duration: .6, ease: "power3.out" });
        const shine = gsap.quickTo(light, "xPercent", { duration: .85, ease: "power2.out" });
        let frame = 0;
        const paintScroll = () => {
          const { top, height } = scene.getBoundingClientRect();
          const depth = gsap.utils.clamp(0, 1, -top / (height || 1));
          lens.style.transform = `scale(${1 + .15 * depth})`;
          frame = 0;
        };
        const scroll = () => { if (!frame) frame = requestAnimationFrame(paintScroll); };
        const move = (event: PointerEvent) => {
          if (event.pointerType === "touch") return;
          const bounds = scene.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width - .5;
          const y = (event.clientY - bounds.top) / bounds.height - .5;
          tiltX(-y * 3.5);
          tiltY(x * 5);
          shine(x * 38);
        };
        const center = () => { tiltX(0); tiltY(0); shine(0); };
        scene.addEventListener("pointermove", move);
        scene.addEventListener("pointerleave", center);
        paintScroll();
        const visibility = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) {
            scroll();
            window.addEventListener("scroll", scroll, { passive: true });
          } else window.removeEventListener("scroll", scroll);
        });
        if (visibility) visibility.observe(scene);
        else window.addEventListener("scroll", scroll, { passive: true });
        return () => {
          visibility?.disconnect();
          window.removeEventListener("scroll", scroll);
          scene.removeEventListener("pointermove", move);
          scene.removeEventListener("pointerleave", center);
          cancelAnimationFrame(frame);
          lens.style.removeProperty("transform");
        };
      });
      release = () => media.revert();
    }
    preference.addEventListener("change", enable);
    void enable();
    return () => {
      disposed = true;
      preference.removeEventListener("change", enable);
      release?.();
    };
  }, []);

  return (
    <section id="cinema" ref={section} aria-labelledby="cinema-title" className={styles.intro}>
      <div ref={camera} className={styles.camera} aria-hidden="true">
        <div ref={type} className={styles.typeRoom}>
          <div className={styles.lettering}><div ref={reflection} className={styles.reflection} /></div>
          <div className={styles.screen}><div className={styles.projection}>
            {restored && moodOptions.filter(id => id === mood || decoded.includes(id)).map(id => (
              <Image key={id} src={`/art/${moods[id].art}.webp`} alt="" fill
                sizes="(max-width: 543px) calc(100vw - 28px), (max-width: 760px) 515px, 100vw"
                loading="eager" fetchPriority={id === mood ? "high" : "auto"}
                onLoad={() => setDecoded(current => current.includes(id) ? current : [...current, id])}
                className={styles.projectedFrame} data-active={id === projected} />
            ))}
          </div></div>
        </div>
      </div>
      <div className={styles.center}>
        <div className={styles.program}>
          <ToggleGroup.Root type="single" value={mood} onValueChange={value => { if (isViewingMood(value)) choose(value); }}
            aria-label={t("Настроение просмотра", "Viewing mood")} className={styles.filmstrip}>
            {moodOptions.map(id => (
              <ToggleGroup.Item key={id} value={id} aria-controls="mood-shelf" className={styles.sample}>
                {!compact && <Image src={`/art/${moods[id].art}.webp`} alt="" width={160} height={82} sizes="100px" />}
                <span>{moodCopy(id, locale).label}</span>
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
          <h1 id="cinema-title" aria-live="polite" aria-atomic="true">
            <span className={styles.titleLine}><span className={styles.titleLead}>{t("AI-сериалы", "AI series")}</span></span>{" "}
            <span className={styles.titleLine}>
              <span className={styles.titleEndings}>
                {moodOptions.map(id => (
                  <span key={id} aria-hidden={id !== mood} className={styles.titleEnding}>{moodCopy(id, locale).headline}</span>
                ))}
              </span>
            </span>
          </h1>
          <div className={styles.actions}>
            <Button asChild className={styles.catalog}><a href="#mood-shelf">{t("К подборке", "Explore picks")} <ArrowDown size={16} aria-hidden="true" /></a></Button>
            <Button asChild variant="outline" className={styles.story}><Link href={localizedPath("/feed", locale)}><Play size={15} fill="currentColor" aria-hidden="true" /> {t("Смотреть ленту", "Watch feed")}</Link></Button>
          </div>
        </div>
      </div>
    </section>
  );
}
