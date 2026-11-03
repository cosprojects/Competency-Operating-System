import type { CompetenciesFile, ProfessionCompetencyFile, ProfessionsFile } from "../competency/model/types.ts";
import type { LearningSourceRecord, LearningSourceRegistry } from "./types.ts";

export interface OpenSourceLink {
  id: string;
  title: string;
  url: string;
  kind: LearningSourceRecord["kind"];
  access: LearningSourceRecord["access"];
  authority: LearningSourceRecord["authority"];
  languages: string[];
  topics: string[];
  summary?: string;
  linkedCompetencies: string[];
  discoveryOnly: boolean;
}

export interface ProfessionSourceAggregate {
  professionId: string;
  title: string;
  competencies: number;
  openSources: number;
  primary: number;
  secondary: number;
  aggregators: number;
  sources: OpenSourceLink[];
  withoutOpenSource: string[];
}

export interface OpenSourceAggregationResult {
  generatedAt: string;
  professions: ProfessionSourceAggregate[];
  warnings: string[];
  excluded: Array<{ id: string; reason: string }>;
}

export interface LearningSourceLink {
  competencyId: string;
  sourceIds: string[];
}

const OPEN_ACCESS = new Set(["free", "freemium"]);

/** Собирает открытые источники по профессиям из реестра и связей source→competency. */
export function buildOpenSourceAggregation(input: {
  registry: LearningSourceRegistry;
  links: LearningSourceLink[];
  competencies: CompetenciesFile;
  professions: ProfessionsFile;
  professionCompetencies: ProfessionCompetencyFile[];
  generatedAt: string;
}): OpenSourceAggregationResult {
  const warnings: string[] = [];
  const excluded: Array<{ id: string; reason: string }> = [];
  const sourceById = new Map(input.registry.sources.map((source) => [source.id, source]));
  const competencyById = new Map(input.competencies.competencies.map((item) => [item.id, item]));
  const professionTitle = new Map(input.professions.professions.map((item) => [item.id, item.title]));
  const competencyProfessions = new Map<string, string[]>();
  const professionCompetencyIds = new Map<string, string[]>();
  for (const profession of input.professionCompetencies) {
    professionCompetencyIds.set(profession.professionId, profession.competencies.map((item) => item.competencyId));
    for (const competency of profession.competencies) {
      const list = competencyProfessions.get(competency.competencyId) ?? [];
      if (!list.includes(profession.professionId)) list.push(profession.professionId);
      competencyProfessions.set(competency.competencyId, list);
    }
  }
  const linksBySource = new Map<string, string[]>();
  const linkedSourcesByCompetency = new Map<string, string[]>();
  for (const link of input.links) {
    if (!competencyById.has(link.competencyId)) {
      warnings.push(`link: компетенция «${link.competencyId}» не найдена в model/competencies.json`);
      continue;
    }
    for (const sourceId of link.sourceIds) {
      if (!sourceById.has(sourceId)) {
        warnings.push(`${link.competencyId}: источник «${sourceId}» не найден в реестре`);
        continue;
      }
      const list = linksBySource.get(sourceId) ?? [];
      if (!list.includes(link.competencyId)) list.push(link.competencyId);
      linksBySource.set(sourceId, list);
      const reverse = linkedSourcesByCompetency.get(link.competencyId) ?? [];
      if (!reverse.includes(sourceId)) reverse.push(sourceId);
      linkedSourcesByCompetency.set(link.competencyId, reverse);
    }
  }
  const byProfession = new Map<string, OpenSourceLink[]>();
  for (const source of input.registry.sources) {
    if (source.status !== "active") {
      excluded.push({ id: source.id, reason: `status=${source.status}` });
      continue;
    }
    if (source.discoveryOnly) {
      excluded.push({ id: source.id, reason: "discoveryOnly: только для обзора, не evidence" });
      continue;
    }
    if (!OPEN_ACCESS.has(source.access)) {
      excluded.push({ id: source.id, reason: `access=${source.access}; открытая агрегация только free/freemium` });
      continue;
    }
    const linked = linksBySource.get(source.id) ?? [];
    const professions = new Set<string>(source.professionIds);
    for (const competencyId of linked) {
      for (const professionId of competencyProfessions.get(competencyId) ?? []) professions.add(professionId);
    }
    for (const professionId of professions) {
      if (!professionTitle.has(professionId)) {
        warnings.push(`${source.id}: профессия «${professionId}» не найдена в model/professions.json`);
        continue;
      }
      const list = byProfession.get(professionId) ?? [];
      list.push({
        id: source.id,
        title: source.title,
        url: source.url,
        kind: source.kind,
        access: source.access,
        authority: source.authority,
        languages: source.languages,
        topics: source.topics,
        ...(source.summary ? { summary: source.summary } : {}),
        linkedCompetencies: linked.map((id) => competencyById.get(id)?.title ?? id).sort((a, b) => a.localeCompare(b)),
        discoveryOnly: Boolean(source.discoveryOnly),
      });
      byProfession.set(professionId, list);
    }
  }
  const professions: ProfessionSourceAggregate[] = [];
  for (const profession of input.professions.professions) {
    const sources = (byProfession.get(profession.id) ?? []).sort((a, b) =>
      (a.authority === "primary" ? 0 : a.authority === "secondary" ? 1 : 2) - (b.authority === "primary" ? 0 : b.authority === "secondary" ? 1 : 2) ||
      a.title.localeCompare(b.title),
    );
    const competencyIds = professionCompetencyIds.get(profession.id) ?? [];
    const covered = new Set(sources.flatMap((source) => source.linkedCompetencies));
    const without = competencyIds
      .filter((id) => !covered.has(competencyById.get(id)?.title ?? id))
      .map((id) => competencyById.get(id)?.title ?? id);
    professions.push({
      professionId: profession.id,
      title: professionTitle.get(profession.id) ?? profession.id,
      competencies: competencyIds.length,
      openSources: sources.length,
      primary: sources.filter((source) => source.authority === "primary").length,
      secondary: sources.filter((source) => source.authority === "secondary").length,
      aggregators: sources.filter((source) => source.authority === "aggregator").length,
      sources,
      withoutOpenSource: without,
    });
  }
  return { generatedAt: input.generatedAt, professions, warnings, excluded };
}

export function renderOpenSourceAggregation(result: OpenSourceAggregationResult): string {
  const lines: string[] = [];
  lines.push('# Открытые учебные источники по профессиям');
  lines.push('');
  lines.push(`Сгенерировано: ${result.generatedAt}.`);
  lines.push('');
  lines.push('Только active источники с доступом free/freemium; blocked, duplicate, paid/mixed и discoveryOnly исключены.');
  lines.push('');
  lines.push('| Профессия | Компетенций | Открытых источников | primary | secondary | aggregator | Без источника |');
  lines.push('|---|---:|---:|---:|---:|---:|---|');
  for (const profession of result.professions) {
    lines.push(`| ${profession.title} | ${profession.competencies} | ${profession.openSources} | ${profession.primary} | ${profession.secondary} | ${profession.aggregators} | ${profession.withoutOpenSource.length} |`);
  }
  lines.push('');
  for (const profession of result.professions) {
    lines.push(`## ${profession.title}`);
    lines.push('');
    lines.push(`Открытых источников: ${profession.openSources}; без открытого источника: ${profession.withoutOpenSource.length}.`);
    lines.push('');
    if (profession.sources.length === 0) {
      lines.push('Открытых источников нет.');
      lines.push('');
      continue;
    }
    for (const source of profession.sources) {
      const linked = source.linkedCompetencies.length > 0 ? ` → ${source.linkedCompetencies.slice(0, 5).join(", ")}` : " → нет связи с компетенцией";
      lines.push(`- [${source.title}](${source.url}) · ${source.authority}/${source.access} · ${source.languages.join(", ")}${linked}`);
    }
    lines.push('');
    if (profession.withoutOpenSource.length > 0) {
      lines.push(`Без открытого источника: ${profession.withoutOpenSource.join(", ")}.`);
      lines.push('');
    }
  }
  if (result.warnings.length > 0) {
    lines.push('## Предупреждения');
    lines.push('');
    for (const warning of result.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }
  if (result.excluded.length > 0) {
    lines.push('## Исключено из открытой агрегации');
    lines.push('');
    for (const item of result.excluded) lines.push(`- ${item.id}: ${item.reason}`);
    lines.push('');
  }
  return `${lines.join("\n")}\n`;
}
