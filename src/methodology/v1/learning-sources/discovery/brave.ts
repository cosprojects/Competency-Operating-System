import type { CompetencyContext } from "./types.ts";
import type { RawProviderHit } from "./wikipedia.ts";
import { queriesForContext } from "./context.ts";

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const UA = "COS-LearningSourcesBot/0.1 (+https://github.com/cosprojects/Competency-Operating-System)";

interface BraveSearchResponse {
  web?: {
    results?: Array<{
      url?: string;
      title?: string;
      description?: string;
      language?: string;
    }>;
  };
}

export interface BraveDiscoveryOptions {
  apiKey: string;
  /** Сколько кандидатов оставить на компетенцию. */
  perContext?: number;
  /** Сколько запросов на компетенцию (экономит месячную квоту). */
  queriesPerContext?: number;
  /** Пауза между запросами: free-тариф Brave ограничивает ~1 запрос/сек. */
  delayMs?: number;
}

/**
 * Официальный Brave Search API (независимый индекс, веб-поиск).
 * Один запрос — один HTTP-вызов; ключ передаётся в X-Subscription-Token.
 * Квоты: free-тариф около 2 000 запросов/месяц, дальше платно — проверяй на brave.com/search/api.
 */
export async function discoverWithBrave(
  fetchImpl: FetchLike,
  contexts: CompetencyContext[],
  options: BraveDiscoveryOptions,
): Promise<RawProviderHit[]> {
  const perContext = options.perContext ?? 6;
  const queriesPerContext = options.queriesPerContext ?? 2;
  const hits: RawProviderHit[] = [];
  for (const context of contexts) {
    const queries = queriesForContext(context).slice(0, queriesPerContext);
    for (const query of queries) {
      const params = new URLSearchParams({
        q: query.query,
        count: "10",
        safesearch: "moderate",
        search_lang: query.language,
      });
      let results: NonNullable<BraveSearchResponse["web"]>["results"] = [];
      if (options.delayMs && options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      try {
        let response = await fetchImpl(
          `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
          {
            headers: {
              "user-agent": UA,
              accept: "application/json",
              "accept-encoding": "gzip",
              "x-subscription-token": options.apiKey,
            },
            signal: AbortSignal.timeout(20_000),
          },
        );
        if (response.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, Math.max(options.delayMs ?? 0, 1500)));
          response = await fetchImpl(
            `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
            {
              headers: {
                "user-agent": UA,
                accept: "application/json",
                "accept-encoding": "gzip",
                "x-subscription-token": options.apiKey,
              },
              signal: AbortSignal.timeout(20_000),
            },
          );
        }
        if (!response.ok) continue;
        const body = (await response.json()) as BraveSearchResponse;
        results = body.web?.results ?? [];
      } catch {
        continue;
      }
      for (const result of results) {
        const url = result.url ?? "";
        const title = (result.title ?? "").trim();
        if (!/^https?:\/\//i.test(url) || !title) continue;
        if (hits.some((hit) => hit.url === url && hit.competencyId === context.competencyId)) continue;
        hits.push({
          url,
          title,
          ...(result.description ? { snippet: result.description.slice(0, 300) } : {}),
          provider: "brave-search",
          competencyId: context.competencyId,
          competencyTitle: context.title,
          query: query.query,
          language: query.language,
        });
        if (hits.filter((hit) => hit.competencyId === context.competencyId).length >= perContext) break;
      }
      if (hits.filter((hit) => hit.competencyId === context.competencyId).length >= perContext) break;
    }
  }
  return hits;
}
