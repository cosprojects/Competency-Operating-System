export const LEARNING_SEARCH_QUERIES: Record<string, string[]> = {
  motion: ["motion design free courses", "motion design school courses", "after effects motion design course", "3d motion design course"],
  uxui: ["ux ui design free courses", "ui ux design course", "figma ui design course", "usability testing course"],
  product: ["product design free courses", "product designer course", "product discovery course", "product design bootcamp"],
  graphic: ["graphic design free courses", "graphic design course", "brand identity course", "editorial design course"],
};

export interface SearchHit {
  title: string;
  url: string;
  snippet?: string;
}

export interface SearchProvider {
  id: string;
  search(query: string, limit: number): Promise<SearchHit[]>;
}

export class GoogleCustomSearchProvider implements SearchProvider {
  id = "google-cse";
  private readonly apiKey: string;
  private readonly cx: string;
  constructor(apiKey: string, cx: string) {
    this.apiKey = apiKey;
    this.cx = cx;
  }
  async search(query: string, limit: number): Promise<SearchHit[]> {
    const params = new URLSearchParams({ key: this.apiKey, cx: this.cx, q: query, num: String(Math.min(limit, 10)) });
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
    if (!response.ok) throw new Error(`Google CSE HTTP ${response.status}`);
    const data = (await response.json()) as { items?: Array<{ title?: string; link?: string; snippet?: string }> };
    return (data.items ?? []).flatMap((item) =>
      item.link ? [{ title: item.title ?? item.link, url: item.link, ...(item.snippet ? { snippet: item.snippet } : {}) }] : [],
    );
  }
}
