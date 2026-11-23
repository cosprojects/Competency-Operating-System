import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { ConsentBanner } from "@/components/ConsentBanner";
import { PageViewTracker } from "@/components/PageViewTracker";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import {
  OG_IMAGE_ALT,
  OG_IMAGE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";
import "./home-footer-gap.css";

/**
 * Подтверждение владения в панелях вебмастеров. Коды приходят из окружения:
 * пока переменная пуста, тег не выводится. DNS-верификация в коде не нужна.
 */
const verification = {
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : {}),
  ...(process.env.YANDEX_SITE_VERIFICATION
    ? { yandex: process.env.YANDEX_SITE_VERIFICATION }
    : {}),
  ...(process.env.BING_SITE_VERIFICATION
    ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
    : {}),
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  // Индексировать и показывать полный сниппет: контент публичный по умолчанию,
  // закрываем точечно на служебных страницах (lib/seo.ts).
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "ru_RU",
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
  ...(Object.keys(verification).length > 0 ? { verification } : {}),
  formatDetection: { telephone: false, email: false, address: false },
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
