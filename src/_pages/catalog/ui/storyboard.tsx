"use client";

import { useI18n } from "@/shared/i18n/context";
import * as Tabs from "@animate-ui/react/primitives/radix-ui/tabs";
import { Film } from "lucide-react";
import styles from "./storyboard.module.css";

export function Storyboard() {
  const { t } = useI18n();
  const shots = [
    {
      id: "antenna",
      label: t("Антенна", "Antenna"),
      title: t("Сигнал с пустой станции", "A signal from an empty station"),
      framing: t("Общий план", "Wide shot"),
      alt: t("Спутниковая тарелка над чёрным базальтовым плато в фиолетовых сумерках.", "A satellite dish rises above a black basalt plateau at violet twilight."),
      note: t("Антенна поворачивается ещё до восхода. На частоте, которую отключили тридцать лет назад, кто-то просит разрешения на посадку.", "Before sunrise, the antenna turns. On a frequency shut down thirty years ago, someone asks for permission to land."),
    },
    {
      id: "voice",
      label: t("Голос", "Voice"),
      title: t("Дыхание в наушнике", "Breathing in the headset"),
      framing: t("Крупный план", "Close-up"),
      alt: t("Инженер прижимает наушник к уху. На приборе за её плечом светится звуковая волна.", "An engineer presses an earpiece to her ear. A waveform glows on the instrument behind her."),
      note: t("Инженер снимает перчатку и прижимает наушник к уху. Диспетчер читает позывные пропавшего экипажа. Последней он называет её.", "The engineer removes her glove and presses the earpiece to her ear. A dispatcher reads out the lost crew’s call signs. Hers is last."),
    },
    {
      id: "door",
      label: t("Шлюз", "Airlock"),
      title: t("Свет по ту сторону", "Light on the other side"),
      framing: t("Глубина кадра", "Depth of field"),
      alt: t("Узкий ребристый коридор лунной станции ведёт к освещённому шлюзу.", "A narrow, ribbed corridor in the lunar station leads to a lit airlock."),
      note: t("Из всех дверей подземного дока свет пропускает только одна. За ней трижды стучат — ровно в том ритме, который она слышала в эфире.", "Light seeps through just one door in the underground dock. Three knocks sound behind it, in the same rhythm she heard on the radio."),
    },
  ] as const;

  return (
    <section id="storyboard" className={styles.section} aria-labelledby="storyboard-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.label}><Film size={17} aria-hidden="true" /> {t("Раскадровка студии", "Studio storyboard")}</p>
          <h2 id="storyboard-title">{t("Нулевая частота", "Zero Frequency")}</h2>
        </div>
        <p className={styles.premise}>{t("На лунной станции инженер ловит передачу экипажа, исчезнувшего тридцать лет назад.", "At a lunar station, an engineer picks up a transmission from a crew that vanished thirty years ago.")}</p>
      </div>
      <Tabs.Root defaultValue={shots[0].id} className={styles.viewer}>
        <Tabs.List className={styles.tabs} aria-label={t("Кадры раскадровки", "Storyboard frames")}>
          {shots.map(shot => <Tabs.Trigger key={shot.id} value={shot.id}>{shot.label}</Tabs.Trigger>)}
        </Tabs.List>
        {shots.map((shot, index) => (
          <Tabs.Content key={shot.id} value={shot.id} className={styles.panel}>
            <figure className={styles.frame}>
              <div className={styles.screen}>
                <img src={`/art/frequency-${shot.id}.webp`} width={1199} height={433} loading="lazy" alt={shot.alt} />
                <span className={styles.counter}>{t("Кадр", "Frame")} {index + 1} / {shots.length}</span>
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
