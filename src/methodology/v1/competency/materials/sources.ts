import type { FetchLike } from "../../candidate-parser/types.ts";
import { htmlToText } from "../../profile/guidance.ts";
import type { AccessType, MaterialKind, SourceRef } from "../types.ts";
import { cleanText } from "../sources/common.ts";

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

async function readJson(fetchImpl: FetchLike, url: string): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Источник ответил ${response.status}`);
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
    const kind: MaterialKind = item.mediatype === "movies" ? "video" : "book";
    return [
      {
        kind,
        title,
        provider: "Internet Archive",
        url,
        canonicalUrl: canonicalizeUrl(url),
        language: "other" as const,
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
