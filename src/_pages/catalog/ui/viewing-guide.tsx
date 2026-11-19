"use client";

import { useI18n } from "@/shared/i18n/context";
import * as Accordion from "@animate-ui/react/primitives/radix-ui/accordion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import styles from "./viewing-guide.module.css";

export function ViewingGuide() {
  const { t } = useI18n();
  const questions = [
    {
      id: "guest",
      title: t("Можно смотреть без аккаунта?", "Can I watch without an account?"),
      answer:
        t("Да. Выберите сериал в каталоге и откройте бесплатную серию. История просмотра и избранное сохраняются в этом браузере.", "Yes. Pick a series from the catalog and open a free episode. You can return to your history and favorites in this browser."),
      href: "/catalog",
      link: t("Открыть каталог", "Browse series"),
    },
    {
      id: "resume",
      title: t("Как вернуться к начатой серии?", "How do I resume an episode?"),
      answer:
        t("Откройте историю и выберите сериал. Кнопка «Продолжить просмотр» вернёт вас к сохранённому моменту. Войдите в аккаунт, чтобы смотреть с другого устройства.", "Open your watch history and choose a series. Continue watching takes you to your saved position. Sign in to pick up on another device."),
      href: "/history",
      link: t("Перейти в историю", "Open watch history"),
    },
    {
      id: "unlock",
      title: t("Как открыть следующую серию?", "How do I unlock the next episode?"),
      answer:
        t("Если серия закрыта, войдите в аккаунт и посмотрите доступные способы в карточке эпизода. Там можно использовать бесплатное открытие или потратить монеты. Стоимость видна до подтверждения.", "If an episode is locked, sign in and check its unlock options. You can use a free unlock or spend coins. You’ll see the price before confirming."),
      href: "/rewards",
      link: t("Проверить бесплатные открытия", "Check free unlocks"),
    },
    {
      id: "coins",
      title: t("Как пополнить кошелёк?", "How do I get more coins?"),
      answer:
        t("Войдите в аккаунт и забирайте бонусные монеты раз в день в разделе наград. Из кошелька можно перейти к покупке пакета монет и посмотреть историю начислений.", "Sign in to claim bonus coins once a day in Rewards. Open your wallet to buy a coin pack or review your transactions."),
      href: "/wallet",
      link: t("Открыть кошелёк", "Open wallet"),
    },
  ] as const;

  return (
    <section id="guide" className={styles.section} aria-labelledby="viewing-guide-title">
      <h2 id="viewing-guide-title" className={styles.title}>
        {t("Гид зрителя", "Viewer guide")}
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
