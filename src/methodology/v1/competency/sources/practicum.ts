import type { FetchLike } from "../../candidate-parser/types.ts";
import { cachedText, fetchText, type CacheOptions } from "../../profile/cache.ts";
import { parsePracticumCatalog, parsePracticumProfessionPage, PRACTICUM_CATALOG_URL } from "../../profile/practicum.ts";
import type { SourceRef, TagKind } from "../types.ts";
import { cleanText } from "./common.ts";

const PRACTICUM_LICENSE =
  "© Яндекс Практикум. Извлекаются названия навыков и короткие цитаты; полные тексты не копируются.";

export interface PracticumTagHit {
  sourceRef: SourceRef;
  title: string;
  definition: string;
  kind: TagKind;
}

function sourceRef(slug: string, retrievedOn: string): SourceRef {
  return {
    sourceId: "practicum",
    externalId: slug,
    url: `https://practicum.yandex.ru/${slug}/`,
    retrievedAt: retrievedOn,
    license: PRACTICUM_LICENSE,
  };
}

export async function collectPracticumTags(
  fetchImpl: FetchLike,
  cache: CacheOptions | undefined,
  slug: string,
  retrievedOn: string,
): Promise<PracticumTagHit[]> {
  const html = await cachedText(cache, `practicum-${slug}`, "html", () =>
    fetchText(fetchImpl, `https://practicum.yandex.ru/${slug}/`, "text/html"),
  );
  const page = parsePracticumProfessionPage(html, slug);
  const ref = sourceRef(slug, retrievedOn);
  return [
    ...page.tools.map((title) => ({
      sourceRef: ref,
      title: cleanText(title),
      definition: `Инструмент на странице программы «${slug}»`,
      kind: "tool" as const,
    })),
    ...page.lessons.map((title) => ({
      sourceRef: ref,
      title: cleanText(title),
      definition: `Тема/навык на странице программы «${slug}»`,
      kind: "knowledge" as const,
    })),
  ].filter((hit) => hit.title.length > 0);
}

export async function collectPracticumCatalogTags(
  fetchImpl: FetchLike,
  cache: CacheOptions | undefined,
  slug: string,
  retrievedOn: string,
): Promise<PracticumTagHit[]> {
  const html = await cachedText(cache, "practicum-catalog-design", "html", () =>
    fetchText(fetchImpl, PRACTICUM_CATALOG_URL, "text/html"),
  );
  const profession = parsePracticumCatalog(html).find((item) => item.slug === slug);
  if (!profession) return [];
  const ignored = new Set(["курс", "дизайн", "поворот в карьере", "parentspro"]);
  const toolNames = new Set(["figma", "chatgpt", "midjourney", "adobe photoshop", "claude", "stable diffusion"]);
  const ref: SourceRef = {
    sourceId: "practicum",
    externalId: `${slug}:catalog`,
    url: `${PRACTICUM_CATALOG_URL}${slug}/`,
    retrievedAt: retrievedOn,
    license: PRACTICUM_LICENSE,
  };
  return profession.tags
    .map((title) => ({ title: cleanText(title), normalized: cleanText(title).toLowerCase() }))
    .filter((item) => item.title.length > 1 && !ignored.has(item.normalized) && !toolNames.has(item.normalized))
    .map((item) => ({
      sourceRef: ref,
      title: item.title,
      definition: `Тег программы «${profession.name}» в каталоге Практикума`,
      kind: "knowledge" as const,
    }));
}
