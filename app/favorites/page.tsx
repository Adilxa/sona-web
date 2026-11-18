import { CatalogPage } from "@/_pages/catalog";

export const metadata = { title: "Избранное" };

export default function Page() {
  return <CatalogPage initialCollection="me/favorites" title="Избранное" />;
}
