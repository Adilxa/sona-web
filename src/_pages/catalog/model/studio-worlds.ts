export function getWorlds(t: (ru: string, en: string) => string) {
  return [
    {
      title: t("Эхо орбиты", "Orbital Echo"),
      genre: t("Космическая драма", "Space drama"),
      art: "signal",
      marker: "var(--brand)",
      line: t("На обратной стороне Луны пилот принимает сигнал с Земли. Её собственный голос просит не возвращаться.", "On the far side of the Moon, a pilot picks up a signal from Earth. Her own voice tells her not to return."),
      note: t("Тёплая полоска света на визоре ведёт взгляд к глазам пилота. Луна за её спиной занимает почти столько же места, сколько лицо.", "A warm streak of light on the visor draws the eye to the pilot’s gaze. The Moon behind her fills almost as much of the frame as her face."),
      alt: t("Пилот в шлеме смотрит в сторону огромной фиолетовой луны над станцией", "A helmeted pilot looks toward a huge violet moon above the station"),
      width: 1912,
      height: 823,
    },
    {
      title: t("Красное солнце", "Red Sun"),
      genre: t("Постапокалипсис", "Post-apocalyptic"),
      art: "desert",
      marker: "var(--coral)",
      line: t("На закате пустыня стирает все следы. У проводницы есть один день, чтобы найти город, которого нет на картах.", "At sunset, the desert erases every footprint. A guide has one day to find a city that appears on no map."),
      note: t("Следы на песке уводят к башне. Даже рядом с огромным солнцем эта тонкая цепочка выдаёт масштаб пустыни.", "Footprints in the sand lead to a tower. Even beside the enormous sun, that thin trail gives away the scale of the desert."),
      alt: t("Путница в красном плаще идёт по дюне к башне на фоне алого солнца", "A traveler in a red cloak crosses a dune toward a tower beneath a scarlet sun"),
      width: 1484,
      height: 530,
    },
    {
      title: t("Тихая вода", "Still Water"),
      genre: t("Мистика", "Mystery"),
      art: "water",
      marker: "var(--blue)",
      line: t("В затопленной оранжерее загорается свет. Ночной смотритель узнаёт растения, исчезнувшие сто лет назад.", "A light comes on in a flooded conservatory. The night watchman recognizes plants that vanished a hundred years ago."),
      note: t("У ручного фонаря есть двойник в воде. Эти две тёплые точки первыми замечаешь среди холодной зелени оранжереи.", "The torch casts a twin reflection on the water. Those two warm spots catch your eye amid the cool green of the conservatory."),
      alt: t("Человек с фонарём стоит в воде под стеклянным куполом оранжереи", "A person with a torch stands in water beneath a glass conservatory dome"),
      width: 1484,
      height: 530,
    },
  ];
}
