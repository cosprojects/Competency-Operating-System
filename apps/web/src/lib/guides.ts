import raw from "../content/generated/guides.json";

/**
 * Кластер разборов знаний и навыков (отдельная база знаний).
 * Источник: src/methodology/v1/guides/content/it.json → generated/guides.json (release-build).
 */

export interface GuideSection {
  heading: string;
  text: string;
}

export interface GuideSource {
  title: string;
  url: string;
  lang: string;
}

export interface GuideItem {
  id: string;
  title: string;
  kind: "knowledge" | "skill";
  competencyTitle: string;
  sectionTitle: string;
  status: "ok" | "no_data";
  sections: GuideSection[];
  sources: GuideSource[];
  generatedAt: string;
  promptVersion: string;
  review: { status: "auto" | "reviewed"; reviewedAt?: string };
  reason?: string;
}

interface GuideFile {
  guidesVersion: string;
  domain: string;
  updatedAt: string;
  promptVersion: string;
  items: Record<string, GuideItem>;
}

const file = raw as unknown as GuideFile;

export function getGuide(itemId: string): GuideItem | undefined {
  return file.items[itemId];
}

/** Человеческая строка источников для модалки: «Источники: Habr, Tilda Education». */
export function sourcesLabel(sources: GuideSource[]): string {
  const unique = [...new Set(sources.map((source) => source.title.trim()).filter(Boolean))];
  return unique.length > 0 ? `Источники: ${unique.join(", ")}` : "Источники: пока не подобраны";
}

export function guideCoverage(): { total: number; ok: number; noData: number } {
  const items = Object.values(file.items);
  return {
    total: items.length,
    ok: items.filter((item) => item.status === "ok").length,
    noData: items.filter((item) => item.status === "no_data").length,
  };
}

export const guidesMeta = {
  version: file.guidesVersion,
  updatedAt: file.updatedAt,
  promptVersion: file.promptVersion,
};
