import raw from "../content/generated/beta-1.json";
import type {
  CompetencyWithProfession,
  ContentCompetency,
  ContentProfession,
  ContentSource,
  PublicContent,
} from "./content-types";

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
    freemium: "Есть бесплатная часть",
    paid: "Платно",
    mixed: "Смешанный доступ",
    unknown: "Доступ не указан",
  };
  return labels[access] ?? access;
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
