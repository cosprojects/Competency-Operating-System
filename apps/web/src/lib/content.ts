import raw from "../content/generated/beta-1.json";
import type {
  CompetencyWithProfession,
  ContentCompetency,
  ContentProfession,
  ContentSection,
  ContentSource,
  PublicContent,
} from "./content-types";
import { FALLBACK_SPHERE, SPHERES, sphereForSlug } from "./spheres";

export const content = raw as unknown as PublicContent;

export function getProfessions(): ContentProfession[] {
  return content.professions;
}

export function getProfession(slug: string): ContentProfession | undefined {
  return content.professions.find((profession) => profession.slug === slug);
}

export function getAllCompetencies(): CompetencyWithProfession[] {
  const result: CompetencyWithProfession[] = [];
  for (const profession of content.professions) {
    for (const section of profession.sections) {
      for (const competency of section.competencies) {
        result.push({ profession, section, competency });
      }
    }
  }
  return result;
}

export function findCompetencies(id: string): CompetencyWithProfession[] {
  return getAllCompetencies().filter((item) => item.competency.id === id);
}

export function findCompetency(id: string): CompetencyWithProfession | undefined {
  return findCompetencies(id)[0];
}

export function findSource(id: string): ContentSource | undefined {
  for (const item of getAllCompetencies()) {
    const source = item.competency.sources.find((candidate) => candidate.id === id);
    if (source) return source;
  }
  return undefined;
}

/** Источник вместе с контекстом компетенции и профессии — для полноценной карточки материала. */
export function findSourceContext(
  id: string,
): { source: ContentSource; competency: ContentCompetency; profession: ContentProfession } | undefined {
  for (const item of getAllCompetencies()) {
    const source = item.competency.sources.find((candidate) => candidate.id === id);
    if (source) return { source, competency: item.competency, profession: item.profession };
  }
  return undefined;
}

export function tierLabel(tier: ContentCompetency["tier"]): string {
  if (tier === "foundation") return "Фундаментальная";
  if (tier === "core") return "Основная";
  return "Необязательная";
}

export function sourceKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    school: "Школа",
    "course-platform": "Курс",
    "video-channel": "Видео",
    "video-playlist": "Видеокурс",
    "portfolio-case": "Кейс",
    aggregator: "Агрегатор",
    blog: "Статья",
    reference: "Справочник",
  };
  return labels[kind] ?? kind;
}

export function accessLabel(access: string): string {
  const labels: Record<string, string> = {
    free: "Бесплатно",
    freemium: "Часть бесплатно",
    paid: "Платно",
    mixed: "Бесплатное и платное",
    unknown: "Доступ не проверен",
  };
  return labels[access] ?? access;
}

/** Подсказка к метке доступа: что именно открыто. */
export function accessHint(access: string): string {
  const hints: Record<string, string> = {
    free: "Доступно без оплаты",
    freemium: "Часть материалов открыта, остальное — по подписке или платно",
    mixed: "В источнике есть и бесплатные, и платные материалы",
    paid: "Полный доступ платный; карточка показывает, что открыто",
    unknown: "Не удалось проверить доступ — помоги уточнить",
  };
  return hints[access] ?? "Доступ не проверен";
}

export function authorityLabel(authority: string): string {
  if (authority === "primary") return "Первичный источник";
  if (authority === "secondary") return "Вторичный источник";
  return "Агрегатор";
}

export function statusLabel(status: "NOT_STARTED" | "LEARNING" | "LEARNED"): string {
  if (status === "LEARNING") return "Изучаю";
  if (status === "LEARNED") return "Изучено";
  return "Не изучено";
}

export function contentTypeSummary(competency: ContentCompetency): string {
  const knowledge = competency.knowledge.length;
  const skills = competency.skills.length;
  const sources = competency.sources.length;
  return `${knowledge} знаний · ${skills} навыков · ${sources} материалов`;
}

/* ------------------------------------------------------------------ */
/* Группы профессий и поиск                                           */
/* ------------------------------------------------------------------ */

export interface ProfessionGroup {
  id: string;
  title: string;
  color: string;
  professions: ContentProfession[];
}

/**
 * Группы профессий на экране выбора строятся из реестра сфер (`lib/spheres`):
 * сфера задаёт название группы и цветовую кодировку бейджа.
 */
export function getProfessionGroups(): ProfessionGroup[] {
  const groups: ProfessionGroup[] = [];
  const placed = new Set<string>();
  for (const sphere of SPHERES) {
    const professions = sphere.slugs
      .map((slug) => getProfessions().find((profession) => profession.slug === slug))
      .filter((profession): profession is ContentProfession => Boolean(profession));
    if (professions.length === 0) continue;
    for (const profession of professions) placed.add(profession.slug);
    // Последние обновлённые профессии — первыми в категории.
    const sorted = [...professions].sort((a, b) =>
      (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    );
    groups.push({ id: sphere.id, title: sphere.title, color: sphere.color, professions: sorted });
  }
  const rest = getProfessions().filter((profession) => !placed.has(profession.slug));
  if (rest.length > 0) {
    groups.push({
      id: FALLBACK_SPHERE.id,
      title: "Другие профессии",
      color: FALLBACK_SPHERE.color,
      professions: rest,
    });
  }
  return groups;
}

/** Сфера деятельности профессии: название и цвет для бейджа. */
export function professionSphere(profession: ContentProfession) {
  return sphereForSlug(profession.slug);
}

export interface ProfessionCompetency {
  profession: ContentProfession;
  section: ContentSection;
  competency: ContentCompetency;
}

export function professionCompetencies(profession: ContentProfession): ProfessionCompetency[] {
  const result: ProfessionCompetency[] = [];
  for (const section of profession.sections) {
    for (const competency of section.competencies) {
      result.push({ profession, section, competency });
    }
  }
  return result;
}

/** Текст компетенции, по которому ищет поиск: название, описание, знания и навыки. */
export function competencySearchText(competency: ContentCompetency): string {
  return [
    competency.title,
    competency.titleEn ?? "",
    competency.definition,
    ...competency.knowledge.map((item) => `${item.title} ${item.definition ?? ""}`),
    ...competency.skills.map((item) => `${item.title} ${item.definition ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replaceAll("ё", "е");
}

export function competencyMatches(competency: ContentCompetency, query: string): boolean {
  const normalized = normalizeQuery(query);
  if (!normalized) return false;
  return competencySearchText(competency).replaceAll("ё", "е").includes(normalized);
}

export function professionMatches(profession: ContentProfession, query: string): boolean {
  const normalized = normalizeQuery(query);
  if (!normalized) return true;
  const haystack = [profession.title, profession.titleEn ?? "", profession.description].join(" ").toLowerCase();
  if (haystack.replaceAll("ё", "е").includes(normalized)) return true;
  return professionCompetencies(profession).some((item) => competencyMatches(item.competency, normalized));
}

export function countLabel(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${forms[0]}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}

export function competencyCounts(competency: ContentCompetency): {
  knowledge: number;
  skills: number;
  sources: number;
} {
  return {
    knowledge: competency.knowledge.length,
    skills: competency.skills.length,
    sources: competency.sources.length,
  };
}

export function competencyMeta(competency: ContentCompetency): string {
  const counts = competencyCounts(competency);
  return `${countLabel(counts.knowledge, ["знание", "знания", "знаний"])} · ${countLabel(
    counts.skills,
    ["навык", "навыка", "навыков"],
  )} · ${countLabel(counts.sources, ["материал", "материала", "материалов"])}`;
}

/* ------------------------------------------------------------------ */
/* Материалы: подразделы                                              */
/* ------------------------------------------------------------------ */

export interface MaterialGroup {
  id: string;
  title: string;
  sources: ContentSource[];
}

const MATERIAL_GROUPS: Array<{ id: string; title: string; kinds: string[] }> = [
  { id: "courses", title: "Курсы", kinds: ["course-platform", "school"] },
  { id: "videos", title: "Видео", kinds: ["video-playlist", "video-channel"] },
  { id: "articles", title: "Статьи", kinds: ["blog", "aggregator"] },
  { id: "references", title: "Справочники", kinds: ["reference"] },
  { id: "cases", title: "Кейсы", kinds: ["portfolio-case"] },
];

/** Разбивает материалы компетенции на подразделы по типу источника. */
export function groupSources(sources: ContentSource[]): MaterialGroup[] {
  const known = new Set(MATERIAL_GROUPS.flatMap((group) => group.kinds));
  // В контенте один и тот же источник может прийти из нескольких блоков —
  // в сайдбаре показываем его один раз.
  const unique = [...new Map(sources.map((source) => [source.id, source])).values()];
  const groups: MaterialGroup[] = [];
  for (const definition of MATERIAL_GROUPS) {
    const items = unique.filter((source) => definition.kinds.includes(source.kind));
    if (items.length > 0) groups.push({ id: definition.id, title: definition.title, sources: items });
  }
  const other = unique.filter((source) => !known.has(source.kind));
  if (other.length > 0) groups.push({ id: "other", title: "Другое", sources: other });
  return groups;
}
