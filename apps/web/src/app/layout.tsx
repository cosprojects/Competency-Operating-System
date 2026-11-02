import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { ConsentBanner } from "@/components/ConsentBanner";
import { PageViewTracker } from "@/components/PageViewTracker";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { getCurrentUser } from "@/lib/auth";
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
      <body>
        <FeedbackProvider>
          <AppShell user={user ? { email: user.email } : null}>{children}</AppShell>
          <ConsentBanner />
          <PageViewTracker />
        </FeedbackProvider>
      </body>
    </html>
  );
}
