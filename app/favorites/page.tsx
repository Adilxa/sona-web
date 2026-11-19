import { pageMetadata } from "@/shared/i18n/server";
import { CatalogPage } from "@/_pages/catalog";

export const generateMetadata = pageMetadata("Избранное", "Favorites");

export default function Page() {
  return <CatalogPage initialCollection="me/favorites" />;
}
