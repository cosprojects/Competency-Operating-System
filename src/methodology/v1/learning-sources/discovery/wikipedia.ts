import type { CompetencyContext } from "./types.ts";
import { articleQueries } from "./context.ts";

/** Сырой хит провайдера до нормализации и скоринга. */
export interface RawProviderHit {
  url: string;
  title: string;
  snippet?: string;
  provider: "wikipedia-extlinks" | "google-cse" | "github-awesome" | "youtube-channel" | "brave-search";
  competencyId: string;
  competencyTitle: string;
  query: string;
  language: "ru" | "en";
  /** Звёзды GitHub-репозитория, если провайдер GitHub. */
  stars?: number;
}

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const UA = "COS-LearningSourcesBot/0.1 (+https://github.com/cosprojects/Competency-Operating-System)";

interface SearchResponse {
  query?: { search?: Array<{ title?: string; snippet?: string }> };
}

interface ExtlinksResponse {
  query?: { pages?: Record<string, { title?: string; extlinks?: Array<{ "*"?: string }> }> };
}

async function getJson(fetchImpl: FetchLike, url: string): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Wikipedia API ответил ${response.status}`);
  return response.json();
}

function stripHtml(value: string | undefined): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

interface ArticleHit {
  title: string;
  snippet: string;
}

const LEARNING_URL =
  /(learn|course|tutorial|school|academy|lesson|class|training|guide|урок|школ|курс|обучен|video|playlist|docs|documentation|education|principles)/i;
const TRUSTED_HINT = /(figma\.com|nngroup\.com|smashingmagazine\.com|alistapart\.com|interaction-design\.org|coursera\.org|edx\.org|stepik\.org|udemy\.com|schoolofmotion\.com|motiondesign\.school)/i;

/** Ссылка похожа на учебный ресурс, а не на новость/книгу/справочную сноску. */
export function looksLikeLearningUrl(url: string): boolean {
  return LEARNING_URL.test(url) || TRUSTED_HINT.test(url);
}

function overlapScore(query: string, title: string): number {
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3);
  const haystack = title.toLowerCase();
  let matched = 0;
  for (const word of words) if (haystack.includes(word)) matched += 1;
  return words.length > 0 ? matched / words.length : 0;
}

async function searchArticles(
  fetchImpl: FetchLike,
  language: "ru" | "en",
  query: string,
  limit: number,
): Promise<ArticleHit[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    format: "json",
    utf8: "1",
    srlimit: String(limit),
  });
  const body = (await getJson(
    fetchImpl,
    `https://${language}.wikipedia.org/w/api.php?${params.toString()}`,
  )) as SearchResponse;
  return (body.query?.search ?? [])
    .flatMap((item) => {
      const title = (item.title ?? "").trim();
      if (!title) return [];
      return [{ title, snippet: stripHtml(item.snippet) }];
    })
    .sort((a, b) => overlapScore(query, b.title) - overlapScore(query, a.title))
    .filter((article) => overlapScore(query, article.title) >= 0.34);
}

async function externalLinks(
  fetchImpl: FetchLike,
  language: "ru" | "en",
  titles: string[],
): Promise<Array<{ article: string; url: string }>> {
  const params = new URLSearchParams({
    action: "query",
    prop: "extlinks",
    ellimit: "100",
    format: "json",
    utf8: "1",
    titles: titles.join("|"),
  });
  const body = (await getJson(
    fetchImpl,
    `https://${language}.wikipedia.org/w/api.php?${params.toString()}`,
  )) as ExtlinksResponse;
  const pages = Object.values(body.query?.pages ?? {});
  const result: Array<{ article: string; url: string }> = [];
  for (const page of pages) {
    for (const link of page.extlinks ?? []) {
      const url = link["*"] ?? "";
      if (!/^https?:\/\//i.test(url)) continue;
      result.push({ article: page.title ?? "", url });
    }
  }
  return result;
}

export interface WikipediaDiscoveryOptions {
  languages?: Array<"ru" | "en">;
  articlesPerQuery?: number;
  maxHitsPerCompetency?: number;
}

/**
 * Авто-расширение ресурсной базы через официальный MediaWiki API:
 * статья Wikipedia по теме → внешние ссылки статьи → возможные учебные источники.
 * Не скрейпит HTML и не обходит ограничения; ссылки дальше проходят нормализацию,
 * скоринг и (опционально) LLM-ревью.
 */
export async function discoverWithWikipedia(
  fetchImpl: FetchLike,
  contexts: CompetencyContext[],
  options: WikipediaDiscoveryOptions = {},
): Promise<RawProviderHit[]> {
  const languages = options.languages ?? ["ru", "en"];
  const articlesPerQuery = options.articlesPerQuery ?? 2;
  const maxHits = options.maxHitsPerCompetency ?? 40;
  const hits: RawProviderHit[] = [];
  for (const context of contexts) {
    const queries = articleQueries(context).filter((query) => languages.includes(query.language));
    const byUrl = new Map<string, RawProviderHit>();
    for (const query of queries) {
      let articles: ArticleHit[] = [];
      try {
        articles = await searchArticles(fetchImpl, query.language, query.query, articlesPerQuery);
      } catch {
        continue;
      }
      const byTitle = new Map(articles.map((article) => [article.title, article]));
      const titles = articles.map((article) => article.title);
      if (titles.length === 0) continue;
      let links: Array<{ article: string; url: string }> = [];
      try {
        links = await externalLinks(fetchImpl, query.language, titles);
      } catch {
        continue;
      }
      for (const link of links) {
        if (byUrl.has(link.url)) continue;
        if (!looksLikeLearningUrl(link.url)) continue;
        const article = byTitle.get(link.article);
        byUrl.set(link.url, {
          url: link.url,
          title: article?.title ?? link.article ?? context.title,
          ...(article?.snippet ? { snippet: article.snippet } : {}),
          provider: "wikipedia-extlinks",
          competencyId: context.competencyId,
          competencyTitle: context.title,
          query: query.query,
          language: query.language,
        });
        if (byUrl.size >= maxHits) break;
      }
      if (byUrl.size >= maxHits) break;
    }
    hits.push(...byUrl.values());
  }
  return hits;
}
