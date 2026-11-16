import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { ConsentBanner } from "@/components/ConsentBanner";
import { PageViewTracker } from "@/components/PageViewTracker";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "AXIONA — карта компетенций дизайнера",
  description:
    "Структурированная карта профессий дизайнера: компетенции, знания, навыки и учебные материалы.",
  metadataBase: new URL(process.env.APP_URL ?? "https://axiona.world"),
  openGraph: {
    title: "AXIONA — карта компетенций дизайнера",
    description: "Профессии, компетенции, знания и навыки, учебные материалы. Beta 1.",
    type: "website",
    locale: "ru_RU",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="ru">
      <head>
        {/* Шрифт грузим сразу: без preload первый экран успевает отрисоваться
            fallback-шрифтом и затем перерисовывается после swap — это читается
            как рывок при загрузке. */}
        <link
          rel="preload"
          href="/fonts/Geist-VariableFont_wght.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {/* Бумага-канвас: единый слой точек, который слегка уходит за курсором,
            пока карточки над ним остаются на месте (COS-EAR-016). */}
        <div className="paper-layer" aria-hidden="true" />
        <FeedbackProvider>
          <MotionProvider>
            <AppShell
              user={
                user
                  ? {
                      email: user.email,
                      createdAt: user.createdAt.toISOString().slice(0, 10),
                      isAdmin: isAdminEmail(user.email),
                    }
                  : null
              }
            >
              {children}
            </AppShell>
            <ConsentBanner />
            <PageViewTracker />
          </MotionProvider>
        </FeedbackProvider>
      </body>
    </html>
  );
}
