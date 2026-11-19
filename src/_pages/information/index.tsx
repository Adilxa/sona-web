import Link from "next/link";
import { getServerLocale } from "@/shared/i18n/server";
import { publicMetadata } from "@/shared/seo/metadata";
import { localizedPath } from "@/shared/seo/urls";
import { InteriorPage } from "@/shared/ui/interior-page";
import { information, type InfoSlug } from "./content";
import styles from "./information.module.css";

export async function informationMetadata(slug: InfoSlug) {
  const locale = await getServerLocale();
  const { title, description } = information[locale][slug];
  return publicMetadata({ path: "/" + slug, locale, title, description });
}

export async function InformationPage({ slug }: { slug: InfoSlug }) {
  const locale = await getServerLocale();
  const ru = locale === "ru";
  const { title, description, sections } = information[locale][slug];
  const operator = process.env.SONA_OPERATOR_NAME?.trim();
  const email = process.env.SONA_SUPPORT_EMAIL?.trim();
  return <InteriorPage title={title} description={description} className={styles.page}
    back={{ href: localizedPath("/", locale), label: ru ? "Главная" : "Home" }}>
    {sections.map(section => <section className={styles.section} key={section.title}>
      <h2>{section.title}</h2>
      <p>{section.text}</p>
      {section.link && <Link href={localizedPath(section.link[0], locale)}>{section.link[1]}</Link>}
    </section>)}
    {(operator || email) && <section className={styles.section}>
      <h2>{ru ? "Контакты" : "Contact"}</h2>
      {operator && <p>{ru ? "Оператор сервиса — " : "Service operator — "}{operator}</p>}
      {email && <p>{ru ? "По вопросам сервиса и ваших данных пишите на " : "For service and privacy requests, email "}<a href={"mailto:" + email}>{email}</a>.</p>}
    </section>}
  </InteriorPage>;
}
