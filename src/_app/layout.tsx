import { AnimateUIProvider } from "@animate-ui/react/provider";
import type { Metadata, Viewport } from "next";
import { SessionProvider } from "@/entities/session";
import { DeviceNotificationSync } from "@/features/notifications/notification-device";
import { QueryProvider } from "./query-provider";
import { Navigation } from "./navigation";
import { SiteFooter } from "./site-footer";
import { MoodProvider } from "@/features/viewing-mood/context";
import { LanguageProvider } from "@/shared/i18n/context";
import { getServerLocale } from "@/shared/i18n/server";
import type { ReactNode } from "react";
import "@fontsource-variable/manrope";
import "@fontsource-variable/unbounded";
import "./styles/globals.css";
import "@/shared/styles/ui.css";

export const viewport: Viewport = { viewportFit: "cover", themeColor: "#100e15" };

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getServerLocale()) === "en";
  return {
    title: { default: en ? "SONA — AI series" : "SONA — AI-сериалы", template: "%s · SONA" },
    description: en ? "Watch vertical AI series, pick an episode, and continue where you left off." : "Смотрите вертикальные AI-сериалы, выбирайте эпизоды и продолжайте просмотр с сохранённого места.",
  };
}

export async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getServerLocale();
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body id="page-top">
        <AnimateUIProvider tempo={0.9} reducedMotion="user">
          <LanguageProvider initial={locale}>
            <QueryProvider>
              <MoodProvider>
                <SessionProvider>
                  <DeviceNotificationSync />
                  <Navigation />
                  <main>{children}</main>
                  <SiteFooter />
                </SessionProvider>
              </MoodProvider>
            </QueryProvider>
          </LanguageProvider>
        </AnimateUIProvider>
      </body>
    </html>
  );
}
