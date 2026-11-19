import { getServerLocale } from "@/shared/i18n/server";
import { publicMetadata } from "@/shared/seo/metadata";
import { FeedPage } from "@/_pages/feed";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return publicMetadata({ path: "/feed", locale,
    title: locale === "ru" ? "Лента вертикальных сериалов" : "Vertical series feed",
    description: locale === "ru"
      ? "Листайте ленту вертикальных AI-сериалов в SONA. Смотрите эпизоды, сохраняйте понравившиеся сериалы и открывайте продолжение."
      : "Swipe through vertical AI series on SONA. Watch episodes, save your favorites and open the series to keep watching.",
  });
}

export default function Page() {
  return <FeedPage />;
}
