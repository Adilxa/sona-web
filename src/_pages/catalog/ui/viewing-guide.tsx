"use client";

import * as Accordion from "@animate-ui/react/primitives/radix-ui/accordion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import styles from "./viewing-guide.module.css";

const questions = [
  {
    id: "guest",
    title: "Можно смотреть без аккаунта?",
    answer:
      "Да. Выберите сериал в каталоге и откройте бесплатную серию. История просмотра и избранное сохраняются в этом браузере.",
    href: "/catalog",
    link: "Открыть каталог",
  },
  {
    id: "resume",
    title: "Как вернуться к начатой серии?",
    answer:
      "Откройте историю и выберите сериал. Кнопка «Продолжить просмотр» вернёт вас к сохранённому моменту. Войдите в аккаунт, чтобы смотреть с другого устройства.",
    href: "/history",
    link: "Перейти в историю",
  },
  {
    id: "unlock",
    title: "Как открыть следующую серию?",
    answer:
      "Если серия закрыта, войдите в аккаунт и посмотрите доступные способы в карточке эпизода. Там можно использовать бесплатное открытие или потратить монеты. Стоимость видна до подтверждения.",
    href: "/rewards",
    link: "Проверить бесплатные открытия",
  },
  {
    id: "coins",
    title: "Как пополнить кошелёк?",
    answer:
      "Войдите в аккаунт и забирайте бонусные монеты раз в день в разделе наград. Из кошелька можно перейти к покупке пакета монет и посмотреть историю начислений.",
    href: "/wallet",
    link: "Открыть кошелёк",
  },
] as const;

export function ViewingGuide() {
  return (
    <section id="guide" className={styles.section} aria-labelledby="viewing-guide-title">
      <h2 id="viewing-guide-title" className={styles.title}>
        Гид зрителя
      </h2>
      <Accordion.Root className={styles.questions} type="single" collapsible defaultValue="guest">
        {questions.map(({ id, title, answer, href, link }) => (
          <Accordion.Item className={styles.item} value={id} key={id}>
            <Accordion.Header className={styles.heading}>
              <Accordion.Trigger className={styles.trigger}>
                {title}
                <span aria-hidden="true" className={styles.toggle} />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>
              <div className={styles.answer}>
                <p>{answer}</p>
                <Link href={href}>
                  {link}
                  <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
                </Link>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}
