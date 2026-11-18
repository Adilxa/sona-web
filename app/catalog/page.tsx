import { redirect } from "next/navigation";
import { CatalogPage } from "@/_pages/catalog";

export const metadata = { title: "Каталог" };

export default async function Page({ searchParams }: PageProps<"/catalog">) {
  const params = await searchParams;
  const value = typeof params.genre === "string" && /^\d+$/.test(params.genre) ? Number(params.genre) : 0;
  const genre = value > 0 && value <= 2147483647 ? value : undefined;
  const sort = params.sort === "popular" ? "popular" : "new";
  if ((params.genre !== undefined && !genre) || (params.sort !== undefined && params.sort !== sort)) {
    const valid = new URLSearchParams();
    if (sort !== "new") valid.set("sort", sort);
    if (genre) valid.set("genre", String(genre));
    redirect(valid.size ? "/catalog?" + valid : "/catalog");
  }
  return <CatalogPage initialCollection="catalog" title="Каталог сериалов" sort={sort} genre={genre} />;
}
