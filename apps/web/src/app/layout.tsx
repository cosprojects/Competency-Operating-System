import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ConsentBanner } from "@/components/ConsentBanner";
import { PageViewTracker } from "@/components/PageViewTracker";
import { content } from "@/lib/content";
import "./globals.css";

export const metadata: Metadata = {
  title: "AXIONA — карта компетенций дизайнера",
  description:
    "Структурированная карта профессий дизайнера: компетенции, знания, навыки и учебные материалы.",
  metadataBase: new URL(process.env.APP_URL ?? "https://axiona.world"),
  openGraph: {
    title: "AXIONA — карта компетенций дизайнера",
    description:
      "Профессии, компетенции, знания и навыки, учебные материалы. Beta 1.",
    type: "website",
    locale: "ru_RU",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <Header />
        <main>
          <div className="container">
            {content.status === "draft" ? (
              <div className="notice" style={{ marginTop: 18 }}>
                Черновой preview Beta 1: {content.stats.publishedCompetencies} компетенций в{" "}
                {content.stats.professions} профессиях. Не публиковать без release:validate и
                status=ready.
              </div>
            ) : null}
            {children}
          </div>
        </main>
        <Footer />
        <ConsentBanner />
        <PageViewTracker />
      </body>
    </html>
  );
}
