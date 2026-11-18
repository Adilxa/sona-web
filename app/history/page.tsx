import { CatalogPage } from "@/_pages/catalog";

export const metadata = { title: "Продолжить просмотр" };

export default function Page() {
  return <CatalogPage initialCollection="me/continue-watching" title="Продолжить просмотр" />;
}
