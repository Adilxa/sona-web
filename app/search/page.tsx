import { redirect } from "next/navigation";

export default async function Page({ searchParams }: PageProps<"/search">) {
  const { q, lang } = await searchParams;
  const search = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const params = new URLSearchParams({ search });
  if (lang === "ru" || lang === "en") params.set("lang", lang);
  redirect("/catalog?" + params);
}
