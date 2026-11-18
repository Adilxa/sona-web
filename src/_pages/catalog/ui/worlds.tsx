"use client";

import { Button } from "@animate-ui/react/primitives/buttons/button";
import { Fade } from "@animate-ui/react/primitives/effects/fade";
import * as Dialog from "@animate-ui/react/primitives/radix-ui/dialog";
import { ArrowLeft, ArrowRight, Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type CSSProperties } from "react";

import { worlds } from "../model/studio-worlds";
import styles from "./worlds.module.css";

export function Worlds() {
  const [active, setActive] = useState(0);
  const opener = useRef<HTMLButtonElement>(null);
  const world = worlds[active];

  function step(direction: number) {
    setActive(index => (index + direction + worlds.length) % worlds.length);
  }

  return (
    <section id="worlds" className={styles.gallery} aria-labelledby="world-title">
      <div className={styles.sectionHeading}>
        <h2 id="world-title" className="section-title">Миры SONA</h2>
        <span>Концепт-арт студии</span>
      </div>
      <Dialog.Root>
        <div id="world-gallery" className={styles.reel}>
          {worlds.map((item, index) => (
            <article key={item.art} id={`world-${item.art}`} className={styles.card} style={{ "--genre": item.marker } as CSSProperties}>
              <Dialog.Trigger asChild>
                <Button
                  className={styles.frame}
                  tapScale={0.99}
                  aria-label={`Открыть кадр «${item.title}»`}
                  onClick={event => {
                    opener.current = event.currentTarget;
                    setActive(index);
                  }}
                >
                  <Image
                    src={`/art/${item.art}.webp`}
                    alt={item.alt}
                    fill
                    sizes={index === 0 ? "(max-width: 700px) 100vw, 42vw" : "(max-width: 700px) 100vw, 30vw"}
                  />
                  <span className={styles.expand} aria-hidden="true"><Maximize2 size={16} /></span>
                </Button>
              </Dialog.Trigger>
              <div className={styles.caption}>
                <span className={styles.genre}>{item.genre}</span>
                <h3>{item.title}</h3>
                <p>{item.line}</p>
              </div>
            </article>
          ))}
        </div>

        <Dialog.Portal>
          <Dialog.Overlay className={styles.backdrop} />
          <Dialog.Content
            className={styles.viewer}
            style={{ "--genre": world.marker } as CSSProperties}
            onCloseAutoFocus={event => {
              event.preventDefault();
              opener.current?.focus({ preventScroll: true });
            }}
            onKeyDown={event => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                step(event.key === "ArrowLeft" ? -1 : 1);
              }
            }}
          >
            <Dialog.Close asChild>
              <Button className={styles.close} aria-label="Закрыть просмотр"><X size={20} /></Button>
            </Dialog.Close>
            <Fade key={world.art} className={styles.scene} initialOpacity={0.75}>
              <Image
                src={`/art/${world.art}.webp`}
                alt={world.alt}
                width={world.width}
                height={world.height}
                unoptimized
              />
            </Fade>
            <div className={styles.details}>
              <div className={styles.story} aria-live="polite" aria-atomic="true">
                <span className={styles.genre}>{world.genre}</span>
                <Dialog.Title>{world.title}</Dialog.Title>
                <Dialog.Description>{world.line}</Dialog.Description>
                <aside className={styles.note} aria-label="Заметка студии">
                  <strong>Заметка студии</strong>
                  <p>{world.note}</p>
                </aside>
              </div>
              <div className={styles.arrows}>
                <span>{active + 1} / {worlds.length}</span>
                <Button aria-label="Предыдущий мир" onClick={() => step(-1)}><ArrowLeft size={19} /></Button>
                <Button aria-label="Следующий мир" onClick={() => step(1)}><ArrowRight size={19} /></Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
