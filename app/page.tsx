import { isLocale } from "@/shared/i18n/model";
import { localizedPath } from "@/shared/seo/urls";
import { redirect } from "next/navigation";
import { getServerLocale } from "@/shared/i18n/server";
import { publicMetadata } from "@/shared/seo/metadata";
import { HomePage } from "@/_pages/catalog/home";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return publicMetadata({ path: "/", locale,
    title: locale === "ru" ? "Вертикальные AI-сериалы онлайн" : "Watch vertical AI series online",
    description: locale === "ru"
      ? "Выберите AI-сериал по настроению, откройте первую серию или продолжите просмотр с сохранённого момента в SONA."
      : "Find a vertical AI series for your mood. Explore the catalog, play the first episode or pick up where you left off on SONA.",
  });
}

export default async function Page({ searchParams }: PageProps<"/">) {
  const { view, lang } = await searchParams;
  if (view === "history" || view === "favorites" || view === "feed") {
    const path = "/" + view;
    redirect(isLocale(lang) ? localizedPath(path, lang) : path);
  }
  return <HomePage />;
}
