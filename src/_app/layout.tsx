import { AnimateUIProvider } from "@animate-ui/react/provider";
import type { Metadata, Viewport } from "next";
import { SessionProvider } from "@/entities/session";
import { DeviceNotificationSync } from "@/features/notifications/notification-device";
import { QueryProvider } from "./query-provider";
import { Navigation } from "./navigation";
import { SiteFooter } from "./site-footer";
import { MoodProvider } from "@/features/viewing-mood/context";
import type { ReactNode } from "react";
import "@fontsource-variable/manrope";
import "@fontsource-variable/unbounded";
import "./styles/globals.css";
import "@/shared/styles/ui.css";

export const viewport: Viewport = { viewportFit: "cover", themeColor: "#100e15" };

export const metadata: Metadata = {
  title: { default: "SONA — AI-сериалы", template: "%s · SONA" },
  description: "Смотрите вертикальные AI-сериалы, выбирайте эпизоды и продолжайте просмотр с сохранённого места.",
};

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body id="page-top">
        <AnimateUIProvider tempo={0.9} reducedMotion="user">
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
        </AnimateUIProvider>
      </body>
    </html>
  );
}
