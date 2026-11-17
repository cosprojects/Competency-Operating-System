/**
 * Пилот контентного слоя «разборы пунктов» (знания/навыки).
 *
 * Задача: проверить сквозной конвейер на 40–60 пунктах одной профессии:
 *   план запросов → поиск → фильтр → загрузка источника → синтез → валидатор → кластер → отчёт.
 *
 * Результат прогона — data/guides/<run>/ (в git не коммитится); валидные разборы
 * складываются в отдельный кластер src/methodology/v1/guides/content/<domain>.json.
 */

export type ItemKind = "knowledge" | "skill";

export interface ItemInput {
  id: string;
  kind: ItemKind;
  title: string;
  definition: string;
  competencyTitle: string;
  sectionTitle: string;
}

export interface SearchHit {
  title: string;
  url: string;
  description: string;
  lang?: string;
  score: number;
  query: string;
  queryLang: "ru" | "en";
}

export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  chars: number;
  cyrShare: number;
  headings: number;
  error?: string;
}

export interface GuideSource {
  title: string;
  url: string;
  host: string;
  lang: "ru" | "en";
  chars: number;
}

export type GuideStatus = "ok" | "no_data";

export interface GuideSection {
  heading: string;
  text: string;
}

export interface GuideDoc {
  status: "ok";
  sections: GuideSection[];
}

export type GuideContent = GuideDoc | { status: "no_data" };

export interface GuideResult {
  item: ItemInput;
  status: GuideStatus;
  guide: GuideDoc | null;
  sources: GuideSource[];
  queries: { ru: string; en?: string };
  reason?: string;
  tokens: { input: number; output: number };
  costUsd: number;
}

/** Кластер разборов: отдельная база знаний, которую можно сегментировать по тегам. */
export interface GuideClusterItem {
  id: string;
  title: string;
  kind: ItemKind;
  competencyTitle: string;
  sectionTitle: string;
  status: GuideStatus;
  sections: GuideSection[];
  sources: Array<Pick<GuideSource, "title" | "url" | "lang">>;
  generatedAt: string;
  promptVersion: string;
  review: { status: "auto" | "reviewed"; reviewedAt?: string };
  reason?: string;
}

export interface GuideCluster {
  guidesVersion: "1.0.0";
  domain: string;
  updatedAt: string;
  promptVersion: string;
  items: Record<string, GuideClusterItem>;
}
