import type { FetchLike } from "../../candidate-parser/types.ts";
import { cachedText, fetchText, type CacheOptions } from "../../profile/cache.ts";
import { parsePracticumProfessionPage } from "../../profile/practicum.ts";
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
