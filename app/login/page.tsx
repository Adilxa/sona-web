import { LoginPage } from "@/_pages/login";

export const metadata = { title: "Вход в SONA" };

export default async function Page({ searchParams }: PageProps<"/login">) {
  const { next, link } = await searchParams;
  const destination = typeof next === "string" && (["/settings", "/shop", "/wallet", "/rewards", "/devices", "/history", "/favorites"].includes(next) || /^\/series\/[1-9]\d*(?:\?episode=[1-9]\d*(?:&at=(?:0|[1-9]\d*))?)?$/.test(next)) ? next : "/profile";
  return <LoginPage key={link === "email" ? "link" : "login"} destination={destination} linkEmail={link === "email"} />;
}
