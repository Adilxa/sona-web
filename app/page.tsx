import { redirect } from "next/navigation";
import { HomePage } from "@/_pages/catalog/home";

export default async function Page({ searchParams }: PageProps<"/">) {
  const { view } = await searchParams;
  if (view === "history") redirect("/history");
  if (view === "favorites") redirect("/favorites");
  if (view === "feed") redirect("/feed");
  return <HomePage />;
}
