import type { CompetencyContext } from "./types.ts";
import type { RawProviderHit } from "./wikipedia.ts";

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

interface YoutubeSearchResponse {
  items?: Array<{
    id?: { channelId?: string };
    snippet?: { title?: string; description?: string };
  }>;
}

/**
 * Авто-расширение через официальный YouTube Data API: каналы по теме компетенции.
 * Требует YOUTUBE_API_KEY; без ключа провайдер не вызывается.
 */
export async function discoverWithYoutube(
  fetchImpl: FetchLike,
  contexts: CompetencyContext[],
  options: { apiKey: string; perContext?: number },
): Promise<RawProviderHit[]> {
  const perContext = options.perContext ?? 2;
  const hits: RawProviderHit[] = [];
  for (const context of contexts) {
    const topic = context.titleEn ?? context.title;
    for (const language of ["ru", "en"] as const) {
      const query = language === "ru" ? `${context.title} обучение` : `${topic} tutorial`;
      const params = new URLSearchParams({
        part: "snippet",
        type: "channel",
        q: query,
        maxResults: "5",
        relevanceLanguage: language,
        key: options.apiKey,
      });
      let items: YoutubeSearchResponse["items"] = [];
      try {
        const response = await fetchImpl(
          `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
          { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) },
        );
        if (!response.ok) continue;
        const body = (await response.json()) as YoutubeSearchResponse;
        items = body.items ?? [];
      } catch {
        continue;
      }
      for (const item of items) {
        const channelId = item.id?.channelId;
        const title = (item.snippet?.title ?? "").trim();
        if (!channelId || !title) continue;
        const url = `https://www.youtube.com/channel/${channelId}`;
        if (hits.some((hit) => hit.url === url && hit.competencyId === context.competencyId)) continue;
        hits.push({
          url,
          title,
          ...(item.snippet?.description ? { snippet: item.snippet.description.slice(0, 300) } : {}),
          provider: "youtube-channel",
          competencyId: context.competencyId,
          competencyTitle: context.title,
          query,
          language,
        });
        if (hits.filter((hit) => hit.competencyId === context.competencyId).length >= perContext) break;
      }
      if (hits.filter((hit) => hit.competencyId === context.competencyId).length >= perContext) break;
    }
  }
  return hits;
}
