/**
 * Микроразметка schema.org для поисковиков (JSON-LD).
 *
 * Что даёт: поисковики понимают, что это за организация, сайт и профессия,
 * и склеивают сущности между собой. Богатые сниппеты для «Профессии» появятся
 * после видимых хлебных крошек и FAQ — они вне этой итерации.
 *
 * Правила: только реальные данные из модели, без выдуманных полей и оценок.
 */
import type { ContentCompetency, ContentProfession } from "./content-types";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, siteUrl } from "./site";

export type JsonLdNode = Record<string, unknown>;

const CONTEXT = "https://schema.org";
const LANGUAGE = "ru-RU";

/** Организация-владелец продукта. Одна на весь сайт. */
export function organizationJsonLd(): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl("/"),
    logo: siteUrl("/brand/logo-mark.svg"),
    description: SITE_DESCRIPTION,
  };
}

/** Сайт как сущность: имя, язык, адрес. Даёт поисковику бренд-узел. */
export function websiteJsonLd(): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl("/"),
    inLanguage: LANGUAGE,
    description: SITE_DESCRIPTION,
    publisher: { "@type": "Organization", name: SITE_NAME, url: siteUrl("/") },
  };
}

/** Профессия как род занятий: имя, описание, раздел карты. */
export function professionJsonLd(profession: ContentProfession, sphereTitle: string): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "Occupation",
    name: profession.title,
    description: profession.description,
    url: siteUrl(`/professions/${profession.slug}`),
    inLanguage: LANGUAGE,
    occupationalCategory: sphereTitle,
    isPartOf: {
      "@type": "CollectionPage",
      name: "Направления",
      url: siteUrl("/professions"),
    },
  };
}

/** Список направлений: даёт поисковику связи между страницами профессий. */
export function professionsListJsonLd(professions: ContentProfession[]): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "CollectionPage",
    name: "Направления дизайна",
    url: siteUrl("/professions"),
    inLanguage: LANGUAGE,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: siteUrl("/") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: professions.length,
      itemListElement: professions.map((profession, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: profession.title,
        url: siteUrl(`/professions/${profession.slug}`),
      })),
    },
  };
}

/**
 * Компетенция как термин в карте знаний профессии. Своя страница у каждой
 * компетенции — с этого адреса начинается длинный хвост запросов.
 */
export function competencyJsonLd(
  competency: ContentCompetency,
  profession: ContentProfession,
): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "DefinedTerm",
    name: competency.title,
    description: competency.definition,
    url: siteUrl(`/professions/${profession.slug}/${competency.id}`),
    termCode: competency.id,
    inLanguage: LANGUAGE,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: `Карта компетенций: ${profession.title}`,
      url: siteUrl(`/professions/${profession.slug}`),
    },
  };
}
