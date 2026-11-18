import { redirect } from "next/navigation";

export default async function Page({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim().slice(0, 100) : "";
  redirect("/catalog?" + new URLSearchParams({ search }));
}
