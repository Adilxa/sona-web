"use client";

import * as Tabs from "@animate-ui/react/primitives/radix-ui/tabs";
import { Film } from "lucide-react";
import styles from "./storyboard.module.css";

const shots = [
  {
    id: "antenna",
    label: "Антенна",
    title: "Сигнал с пустой станции",
    framing: "Общий план",
    alt: "Спутниковая тарелка над чёрным базальтовым плато в фиолетовых сумерках.",
    note: "Антенна поворачивается ещё до восхода. На частоте, которую отключили тридцать лет назад, кто-то просит разрешения на посадку.",
  },
  {
    id: "voice",
    label: "Голос",
    title: "Дыхание в наушнике",
    framing: "Крупный план",
    alt: "Инженер прижимает наушник к уху. На приборе за её плечом светится звуковая волна.",
    note: "Инженер снимает перчатку и прижимает наушник к уху. Диспетчер читает позывные пропавшего экипажа. Последней он называет её.",
  },
  {
    id: "door",
    label: "Шлюз",
    title: "Свет по ту сторону",
    framing: "Глубина кадра",
    alt: "Узкий ребристый коридор лунной станции ведёт к освещённому шлюзу.",
    note: "Из всех дверей подземного дока свет пропускает только одна. За ней трижды стучат — ровно в том ритме, который она слышала в эфире.",
  },
] as const;

export function Storyboard() {
  return (
    <section id="storyboard" className={styles.section} aria-labelledby="storyboard-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.label}><Film size={17} aria-hidden="true" /> Раскадровка студии</p>
          <h2 id="storyboard-title">Нулевая частота</h2>
        </div>
        <p className={styles.premise}>На лунной станции инженер ловит передачу экипажа, исчезнувшего тридцать лет назад.</p>
      </div>
      <Tabs.Root defaultValue={shots[0].id} className={styles.viewer}>
        <Tabs.List className={styles.tabs} aria-label="Кадры раскадровки">
          {shots.map(shot => <Tabs.Trigger key={shot.id} value={shot.id}>{shot.label}</Tabs.Trigger>)}
        </Tabs.List>
        {shots.map((shot, index) => (
          <Tabs.Content key={shot.id} value={shot.id} className={styles.panel}>
            <figure className={styles.frame}>
              <div className={styles.screen}>
                <img src={`/art/frequency-${shot.id}.webp`} width={1199} height={433} loading="lazy" alt={shot.alt} />
                <span className={styles.counter}>Кадр {index + 1} / {shots.length}</span>
              </div>
              <figcaption className={styles.caption}>
                <div><span>{shot.framing}</span><h3>{shot.title}</h3></div>
                <p>{shot.note}</p>
              </figcaption>
            </figure>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </section>
  );
}
