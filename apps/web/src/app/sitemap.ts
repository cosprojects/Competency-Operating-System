import type { MetadataRoute } from "next";
import { legalDocuments } from "@/content/legal";
import { getProfessions } from "@/lib/content";
import { siteUrl } from "@/lib/site";

/**
 * Карта сайта: только канонические адреса без параметров.
 *
 * Раньше открытая компетенция была параметром `?competency=…`: 157 из 176
 * адресов в карте были одной и той же страницей, а `lastmod` у всех стоял
 * «сейчас» — при каждом переобходе всё выглядело изменённым. Теперь у каждой
 * компетенции свой адрес (`/professions/[slug]/[competency]`), и она попадает
 * сюда как отдельная страница с реальной датой правки из модели.
 */

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function newest(dates: Array<Date | undefined>): Date | undefined {
  let result: Date | undefined;
  for (const date of dates) {
    if (date && (!result || date.getTime() > result.getTime())) result = date;
  }
  return result;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const professions = getProfessions();
  const contentUpdatedAt = newest(professions.map((profession) => parseDate(profession.updatedAt)));

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl("/"),
      ...(contentUpdatedAt ? { lastModified: contentUpdatedAt } : {}),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: siteUrl("/professions"),
      ...(contentUpdatedAt ? { lastModified: contentUpdatedAt } : {}),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    { url: siteUrl("/plan"), changeFrequency: "monthly", priority: 0.6 },
  ];

  const professionPages: MetadataRoute.Sitemap = professions.map((profession) => {
    const lastModified = parseDate(profession.updatedAt);
    return {
      url: siteUrl(`/professions/${profession.slug}`),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    };
  });

  // Компетенция — отдельная страница со своим названием и описанием. Это тот
  // самый длинный хвост: «что входит в компетенцию…», «навыки …».
  //
  // В карту попадает только канонический адрес компетенции — первое вхождение в
  // модели. Одна и та же компетенция встречается у нескольких профессий (514
  // вхождений против 157 разных), и все вхождения перечислять нельзя: это почти
  // одинаковые документы. Дата правки — из профессии: своей даты у компетенции
  // в модели пока нет.
  const seenCompetencies = new Set<string>();
  const competencyPages: MetadataRoute.Sitemap = [];
  for (const profession of professions) {
    const lastModified = parseDate(profession.updatedAt);
    for (const section of profession.sections) {
      for (const competency of section.competencies) {
        if (seenCompetencies.has(competency.id)) continue;
        seenCompetencies.add(competency.id);
        competencyPages.push({
          url: siteUrl(`/professions/${profession.slug}/${competency.id}`),
          ...(lastModified ? { lastModified } : {}),
          changeFrequency: "monthly" as const,
          priority: 0.6,
        });
      }
    }
  }

  const legalPages: MetadataRoute.Sitemap = legalDocuments.map((document) => {
    const lastModified = parseDate(document.updated);
    return {
      url: siteUrl(`/legal/${document.slug}`),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    };
  });

  return [...staticPages, ...professionPages, ...competencyPages, ...legalPages];
}
