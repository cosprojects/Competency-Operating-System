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

const MAX_TAG_LENGTH = 80;
const SENTENCE = /[.!?](\s|$)/;
const MARKETING_PREFIX =
  /^(выстро|посет|состав|потрен|науч|смож|узна|получ|подключ|применя|примен|предсказ|портфол|куп|найд|выбер|разбер|изуч|осво|попроб|рассмотр)/i;
const CAREER_BOILERPLATE = /(карьер|ваканс|резюме|портфолио|зарплат|фриланс|отклик|сопроводительн|стажиров|работодател|ментор|мастерск|собеседован|трудоустро|поиск работы|поиска работы|куда пойти|пойти работать)/i;
const QUESTION_PREFIX = /^(как|какие|какой|какая|что|куда|зачем|почему|когда|сколько)(\s|$)/i;
const FIRST_PERSON_PREFIX = /^(владею|создаю|делаю|монтирую|использую|понимаю|разбираюсь|умею|знаю|учусь|посмотрю)/i;
const GENERIC_TITLES = new Set(["профессия", "инструменты и навыки"]);

/**
 * Тема курса должна быть короткой фразой, а не абзацем. Страницы Практикума
 * содержат и уроки, и маркетинговые тексты — фильтр не даёт им стать тегами.
 */
export function isUsablePracticumTitle(title: string): boolean {
  const value = cleanText(title);
  if (value.length < 2 || value.length > MAX_TAG_LENGTH) return false;
  if (SENTENCE.test(value)) return false;
  if (MARKETING_PREFIX.test(value)) return false;
  if (CAREER_BOILERPLATE.test(value)) return false;
  if (QUESTION_PREFIX.test(value)) return false;
  if (FIRST_PERSON_PREFIX.test(value)) return false;
  if (GENERIC_TITLES.has(value.toLowerCase())) return false;
  return true;
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
    ...page.lessons
      .filter((title) => isUsablePracticumTitle(title))
      .map((title) => ({
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
    .filter((item) => isUsablePracticumTitle(item.title))
    .map((item) => ({
      sourceRef: ref,
      title: item.title,
      definition: `Тег программы «${profession.name}» в каталоге Практикума`,
      kind: "knowledge" as const,
    }));
}
