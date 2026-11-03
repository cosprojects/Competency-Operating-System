import type { CompetencyContext } from "./types.ts";
import type { RawProviderHit } from "./wikipedia.ts";

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const UA = "COS-LearningSourcesBot/0.1 (+https://github.com/cosprojects/Competency-Operating-System)";

interface GithubRepo {
  full_name?: string;
  html_url?: string;
  description?: string | null;
  stargazers_count?: number;
  archived?: boolean;
  topics?: string[];
  language?: string | null;
}

interface GithubSearchResponse {
  items?: GithubRepo[];
}

/**
 * Авто-расширение через официальный GitHub Search API (без ключа, лимит 10 поисков/мин;
 * с GITHUB_TOKEN — выше). Ищем курируемые подборки «awesome …» по теме компетенции.
 * Это reference-источники, а не доказательство знаний; приёмка — Pass E/человек.
 */
export async function discoverWithGithub(
  fetchImpl: FetchLike,
  contexts: CompetencyContext[],
  options: { minStars?: number; perContext?: number; delayMs?: number } = {},
): Promise<RawProviderHit[]> {
  const minStars = options.minStars ?? 100;
  const perContext = options.perContext ?? 3;
  const token = process.env.GITHUB_TOKEN;
  const hits: RawProviderHit[] = [];
  for (const context of contexts) {
    const topic = context.titleEn ?? context.title;
    for (const suffix of ["awesome", "resources"]) {
      const query = encodeURIComponent(`${topic} ${suffix}`);
      const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=5`;
      if (options.delayMs && options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      let repos: GithubRepo[] = [];
      try {
        const response = await fetchImpl(url, {
          headers: {
            "user-agent": UA,
            accept: "application/vnd.github+json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) continue;
        const body = (await response.json()) as GithubSearchResponse;
        repos = body.items ?? [];
      } catch {
        continue;
      }
      for (const repo of repos) {
        if (!repo.html_url || !repo.full_name) continue;
        if (repo.archived) continue;
        const stars = repo.stargazers_count ?? 0;
        if (stars < minStars) continue;
        const description = (repo.description ?? "").trim();
        hits.push({
          url: repo.html_url,
          title: repo.full_name,
          snippet: [description, ...(repo.topics ?? []).slice(0, 6)].filter(Boolean).join(" · "),
          provider: "github-awesome",
          competencyId: context.competencyId,
          competencyTitle: context.title,
          query: `${topic} ${suffix}`,
          language: "en",
          stars,
        });
        if (hits.filter((hit) => hit.competencyId === context.competencyId).length >= perContext) break;
      }
      if (hits.filter((hit) => hit.competencyId === context.competencyId).length >= perContext) break;
    }
  }
  return hits;
}
