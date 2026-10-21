import type { FetchLike } from "../../candidate-parser/types.ts";
import { htmlToText } from "../../profile/guidance.ts";
import type { AccessType, MaterialKind, SourceRef } from "../types.ts";
import { cleanText, slugify } from "../sources/common.ts";

export interface MaterialDraft {
  kind: MaterialKind;
  title: string;
  provider: string;
  url: string;
  canonicalUrl: string;
  language: "ru" | "en" | "other";
  access: AccessType;
  price?: {
    amount?: number;
    currency?: string;
    note?: string;
    observedAt: string;
  };
  description: string;
  snippet?: string;
  license: string;
  sourceRef: SourceRef;
  publishedAt?: string;
  retrievedAt: string;
}

export function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return raw.trim();
  }
}

function snippetOf(raw: string | undefined, max = 320): string | undefined {
  const text = cleanText(raw ? htmlToText(raw) : "");
  if (!text) return undefined;
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function normalizeLanguage(value: string | undefined): "ru" | "en" | "other" {
  const text = cleanText(value).toLowerCase();
  if (/^(ru|rus|russian|рус|русский)/.test(text)) return "ru";
  if (/^(en|eng|english|англ)/.test(text)) return "en";
  return "other";
}

const USER_AGENT =
  "CosCompetencyResearch/0.1 (+https://github.com/cosprojects/Competency-Operating-System)";

class NonRetryableHttpError extends Error {}

async function requestWithRetry(
  fetchImpl: FetchLike,
  url: string,
  init: Parameters<FetchLike>[1],
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, init);
      if (response.ok) return response;
      if (response.status < 500) throw new NonRetryableHttpError(`Источник ответил ${response.status}`);
      lastError = new Error(`Источник ответил ${response.status}`);
    } catch (error) {
      if (error instanceof NonRetryableHttpError) throw error;
      lastError = error;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error("Источник недоступен");
}

async function readText(fetchImpl: FetchLike, url: string): Promise<string> {
  const response = await requestWithRetry(fetchImpl, url, {
    headers: {
      Accept: "application/rss+xml, text/xml, application/xml, text/html",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(30_000),
  });
  const withText = response as unknown as { text?: () => Promise<string> };
  if (!withText.text) throw new Error("Источник не отдал текст");
  return withText.text();
}

function stripHtml(raw: string | undefined): string {
  return cleanText(raw ? htmlToText(raw) : "");
}

function cdata(raw: string): string {
  return raw.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function rssItem(xml: string, tag: string): string {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(pattern);
  if (!match) return "";
  const value = match[1] ?? "";
  if (value.includes("<![CDATA[")) {
    return cdata(value.replace(/^\s+/, "").trim());
  }
  return stripHtml(value);
}

async function readJson(fetchImpl: FetchLike, url: string): Promise<unknown> {
  const response = await requestWithRetry(fetchImpl, url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  return response.json();
}

export async function searchWikipedia(
  fetchImpl: FetchLike,
  query: string,
  retrievedOn: string,
  limit = 5,
): Promise<MaterialDraft[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    format: "json",
    utf8: "1",
    srlimit: String(limit),
  });
  const body = (await readJson(fetchImpl, `https://ru.wikipedia.org/w/api.php?${params.toString()}`)) as {
    query?: { search?: Array<{ title?: string; snippet?: string; pageid?: number }> };
  };
  const results = body.query?.search ?? [];
  return results.flatMap((item) => {
    const title = cleanText(item.title);
    if (!title) return [];
    const url = `https://ru.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    const snippet = snippetOf(item.snippet);
    return [
      {
        kind: "article" as const,
        title,
        provider: "Wikipedia",
        url,
        canonicalUrl: canonicalizeUrl(url),
        language: "ru" as const,
        access: "free" as const,
        description: snippet ?? title,
        ...(snippet ? { snippet } : {}),
        license: "CC BY-SA 4.0",
        sourceRef: {
          sourceId: "wikipedia",
          externalId: String(item.pageid ?? title),
          url,
          retrievedAt: retrievedOn,
          license: "CC BY-SA 4.0",
        },
        retrievedAt: retrievedOn,
      },
    ];
  });
}

export async function searchInternetArchive(
  fetchImpl: FetchLike,
  query: string,
  retrievedOn: string,
  limit = 5,
): Promise<MaterialDraft[]> {
  const params = new URLSearchParams();
  params.set("q", `title:(${query}) AND (mediatype:movies OR mediatype:texts)`);
  params.append("fl[]", "identifier");
  params.append("fl[]", "title");
  params.append("fl[]", "mediatype");
  params.append("fl[]", "description");
  params.append("fl[]", "licenseurl");
  params.append("fl[]", "language");
  params.set("rows", String(limit));
  params.set("page", "1");
  params.set("output", "json");
  const body = (await readJson(
    fetchImpl,
    `https://archive.org/advancedsearch.php?${params.toString()}`,
  )) as {
    response?: {
      docs?: Array<{
        identifier?: string;
        title?: string | string[];
        mediatype?: string;
        description?: string | string[];
        licenseurl?: string;
        language?: string | string[];
      }>;
    };
  };
  return (body.response?.docs ?? []).flatMap((item) => {
    const identifier = cleanText(item.identifier);
    const rawTitle = Array.isArray(item.title) ? item.title[0] : item.title;
    const title = cleanText(rawTitle);
    if (!identifier || !title) return [];
    const url = `https://archive.org/details/${identifier}`;
    const rawDescription = Array.isArray(item.description) ? item.description[0] : item.description;
    const snippet = snippetOf(rawDescription);
    const rawLanguage = Array.isArray(item.language) ? item.language[0] : item.language;
    const language = normalizeLanguage(rawLanguage);
    const kind: MaterialKind = item.mediatype === "movies" ? "video" : "book";
    return [
      {
        kind,
        title,
        provider: "Internet Archive",
        url,
        canonicalUrl: canonicalizeUrl(url),
        language,
        access: "free" as const,
        description: snippet ?? title,
        ...(snippet ? { snippet } : {}),
        license: cleanText(item.licenseurl) || "не указана в записи",
        sourceRef: {
          sourceId: "internet-archive",
          externalId: identifier,
          url,
          retrievedAt: retrievedOn,
          license: cleanText(item.licenseurl) || "не указана",
        },
        retrievedAt: retrievedOn,
      },
    ];
  });
}

export async function searchStepik(
  fetchImpl: FetchLike,
  query: string,
  retrievedOn: string,
  limit = 5,
): Promise<MaterialDraft[]> {
  const params = new URLSearchParams({ search: query, page: "1" });
  const body = (await readJson(fetchImpl, `https://stepik.org/api/courses?${params.toString()}`)) as {
    courses?: Array<{
      id?: number;
      title?: string;
      summary?: string;
      is_paid?: boolean;
      price?: number;
      currency_code?: string;
    }>;
  };
  return (body.courses ?? []).slice(0, limit).flatMap((course) => {
    if (!course.id || !course.title) return [];
    const url = `https://stepik.org/course/${course.id}`;
    const paid = course.is_paid === true;
    const snippet = snippetOf(course.summary);
    return [
      {
        kind: "course" as const,
        title: cleanText(course.title),
        provider: "Stepik",
        url,
        canonicalUrl: canonicalizeUrl(url),
        language: "ru" as const,
        access: paid ? ("paid" as const) : ("free" as const),
        ...(paid && course.price !== undefined
          ? {
              price: {
                amount: course.price,
                currency: course.currency_code ?? "RUB",
                observedAt: retrievedOn,
              },
            }
          : {}),
        description: snippet ?? cleanText(course.title),
        ...(snippet ? { snippet } : {}),
        license: "метаданные Stepik; лицензия курса индивидуальна",
        sourceRef: {
          sourceId: "stepik",
          externalId: String(course.id),
          url,
          retrievedAt: retrievedOn,
          license: "метаданные Stepik",
        },
        retrievedAt: retrievedOn,
      },
    ];
  });
}

export async function searchYoutube(
  fetchImpl: FetchLike,
  query: string,
  retrievedOn: string,
  apiKey: string | undefined,
  limit = 5,
): Promise<MaterialDraft[]> {
  if (!apiKey) return [];
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(limit),
    key: apiKey,
  });
  const body = (await readJson(
    fetchImpl,
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
  )) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: { title?: string; description?: string; publishedAt?: string };
    }>;
  };
  return (body.items ?? []).flatMap((item) => {
    const videoId = item.id?.videoId;
    const title = cleanText(item.snippet?.title);
    if (!videoId || !title) return [];
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const snippet = snippetOf(item.snippet?.description);
    return [
      {
        kind: "video" as const,
        title,
        provider: "YouTube",
        url,
        canonicalUrl: canonicalizeUrl(url),
        language: "other" as const,
        access: "free" as const,
        description: snippet ?? title,
        ...(snippet ? { snippet } : {}),
        license: "метаданные YouTube; условия платформы",
        sourceRef: {
          sourceId: "youtube",
          externalId: videoId,
          url,
          retrievedAt: retrievedOn,
          license: "метаданные YouTube",
        },
        ...(item.snippet?.publishedAt ? { publishedAt: item.snippet.publishedAt } : {}),
        retrievedAt: retrievedOn,
      },
    ];
  });
}


export async function searchHabr(
  fetchImpl: FetchLike,
  query: string,
  retrievedOn: string,
  limit = 5,
): Promise<MaterialDraft[]> {
  const drafts: MaterialDraft[] = [];
  for (const language of ["ru", "en"] as const) {
    const params = new URLSearchParams({
      query,
      fl: language,
      hl: language,
      page: "1",
    });
    const body = (await readJson(
      fetchImpl,
      `https://habr.com/kek/v2/articles/?${params.toString()}`,
    )) as {
      publicationRefs?: Record<
        string,
        {
          id?: string;
          lang?: string;
          titleHtml?: string;
          leadData?: { textHtml?: string };
          timePublished?: string;
          statistics?: { score?: number; readingCount?: number };
        }
      >;
    };
    const refs = Object.values(body.publicationRefs ?? {}).slice(0, limit);
    for (const ref of refs) {
      const id = cleanText(ref.id);
      const title = stripHtml(ref.titleHtml);
      if (!id || !title) continue;
      const lang = normalizeLanguage(ref.lang);
      if (lang === "other") continue;
      const url = `https://habr.com/${lang}/articles/${id}/`;
      const snippet = snippetOf(ref.leadData?.textHtml);
      const score = ref.statistics?.score;
      drafts.push({
        kind: "article",
        title,
        provider: "Хабр",
        url,
        canonicalUrl: canonicalizeUrl(url),
        language: lang,
        access: "free",
        description: snippet ?? title,
        ...(snippet ? { snippet } : {}),
        license: "Habr ToS; авторские права автора",
        sourceRef: {
          sourceId: "habr",
          externalId: id,
          url,
          retrievedAt: retrievedOn,
          license: "Habr ToS",
        },
        ...(ref.timePublished ? { publishedAt: ref.timePublished } : {}),
        retrievedAt: retrievedOn,
      });
      if (typeof score === "number") {
        drafts[drafts.length - 1]!.description = `${drafts[drafts.length - 1]!.description} (score ${score})`;
      }
    }
  }
  const seen = new Set<string>();
  return drafts.filter((draft) => {
    if (seen.has(draft.canonicalUrl)) return false;
    seen.add(draft.canonicalUrl);
    return true;
  });
}

function mediumTagFor(title: string): string {
  const words = slugify(title, "topic")
    .split("-")
    .filter((word) => word && !["and", "the", "of", "in", "for", "to", "a", "an"].includes(word));
  return words.slice(0, 2).join("-") || "topic";
}

export async function searchMedium(
  fetchImpl: FetchLike,
  query: string,
  retrievedOn: string,
  limit = 5,
): Promise<MaterialDraft[]> {
  const tag = mediumTagFor(query);
  const xml = await readText(fetchImpl, `https://medium.com/feed/tag/${encodeURIComponent(tag)}`);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, limit);
  return items.flatMap((match) => {
    const item = match[1] ?? "";
    const title = rssItem(item, "title");
    const link = rssItem(item, "link");
    if (!title || !link) return [];
    const description = rssItem(item, "description");
    const snippet = snippetOf(description);
    const url = canonicalizeUrl(link);
    return [
      {
        kind: "article" as const,
        title,
        provider: "Medium",
        url,
        canonicalUrl: url,
        language: "en" as const,
        access: "freemium" as const,
        description: snippet ?? title,
        ...(snippet ? { snippet } : {}),
        license: "Medium ToS; авторские права автора",
        sourceRef: {
          sourceId: "medium",
          externalId: url,
          url,
          retrievedAt: retrievedOn,
          license: "Medium ToS",
        },
        retrievedAt: retrievedOn,
      },
    ];
  });
}

/**
 * Learn-Anything отдаёт темы/ссылки через клиентский Jazz sync; публичного
 * HTTP API для поиска нет. Не исполняем клиентский JS и не обходим это.
 */
export async function searchLearnAnything(
  _fetchImpl: FetchLike,
  _query: string,
  _retrievedOn: string,
): Promise<MaterialDraft[]> {
  throw new Error(
    "learn-anything: публичного HTTP API нет; контент отдаётся клиентским Jazz sync, скрейпинг не делаем",
  );
}
