import { pageMetadata } from "@/shared/i18n/server";
import { loginDestination } from "@/shared/seo/urls";
import { LoginPage } from "@/_pages/login";

export const generateMetadata = pageMetadata("Вход", "Sign in");

export default async function Page({ searchParams }: PageProps<"/login">) {
  const { next, link } = await searchParams;
  const destination = loginDestination(next);
  return <LoginPage key={link === "email" ? "link" : "login"} destination={destination} linkEmail={link === "email"} />;
}
