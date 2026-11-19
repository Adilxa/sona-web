import { pageMetadata } from "@/shared/i18n/server";
import { CatalogPage } from "@/_pages/catalog";

export const generateMetadata = pageMetadata("Продолжить просмотр", "Continue watching");

export default function Page() {
  return <CatalogPage initialCollection="me/continue-watching" />;
}
