/**
 * Канонический адрес сайта и общие SEO-константы — один источник правды.
 *
 * До этого layout объявлял `metadataBase` как axiona.world, а robots и sitemap
 * отдавали ссылки на app.axiona.world: в проде спасал APP_URL, в превью и тестах
 * получались ссылки на чужой домен. Теперь домен берётся отсюда.
 *
 * Домен продукта зафиксирован в COS-REL-005 (ADR-025): `app.axiona.world`.
 * `axiona.world` — корпоративный сайт, он сюда не относится.
 */
export const SITE_URL = (process.env.APP_URL ?? "https://app.axiona.world").replace(/\/+$/, "");

export const SITE_NAME = "AXIONA";
export const SITE_TITLE = "AXIONA — карта компетенций дизайнера";
export const SITE_DESCRIPTION =
  "Структурированная карта профессий дизайнера: компетенции, знания, навыки и учебные материалы.";

export const OG_IMAGE_PATH = "/images/og/axiona-1200x630.png";
export const OG_IMAGE_ALT = "AXIONA — карта компетенций дизайнера";

/** Абсолютный URL пути на каноническом домене (metadataBase для метаданных). */
export function siteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Канонический адрес страницы: `alternates.canonical` в metadata. */
export function canonical(path = "/"): { canonical: string } {
  return { canonical: siteUrl(path) };
}

/**
 * Open Graph и Twitter для страницы. Next заменяет openGraph целиком, а не
 * мержит с layout, поэтому каждая страница передаёт свой набор.
 */
export function socialMetadata(input: {
  title: string;
  description: string;
  path: string;
}) {
  return {
    openGraph: {
      title: input.title,
      description: input.description,
      url: siteUrl(input.path),
      siteName: SITE_NAME,
      locale: "ru_RU",
      type: "website" as const,
      images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: input.title,
      description: input.description,
      images: [OG_IMAGE_PATH],
    },
  };
}
