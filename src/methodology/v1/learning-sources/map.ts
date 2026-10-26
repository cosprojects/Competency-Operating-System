import type { CompetenciesFile, ProfessionCompetencyFile } from "../competency/model/types.ts";
import type { LearningSourceRecord, LearningSourceRegistry } from "./types.ts";

export interface LearningSourceCoverage {
  professionId: string;
  total: number;
  covered: number;
  withoutSources: string[];
}

export interface LearningSourceMapResult {
  errors: string[];
  warnings: string[];
  /** sourceId → competencyIds, обратная проекция `competency.learningSourceIds`. */
  bySource: Map<string, string[]>;
  /** competencyId → sourceIds, прямая проекция. */
  byCompetency: Map<string, string[]>;
  coverage: LearningSourceCoverage[];
}

const EVIDENCE_BLOCKED: ReadonlySet<LearningSourceRecord["status"]> = new Set(["blocked", "duplicate"]);

/**
 * Строит и валидирует связь «учебный источник → компетенция».
 *
 * `competency.learningSourceIds` остаётся единственным источником истины; функция даёт
 * обратную проекцию для отчётов и проверяет, что в качестве свидетельства не используются
 * blocked/duplicate источники, а источник объявлен для профессии компетенции.
 */
export function buildLearningSourceMap(input: {
  registry: LearningSourceRegistry;
  competencies: CompetenciesFile;
  professionCompetencies: ProfessionCompetencyFile[];
}): LearningSourceMapResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sources = new Map(input.registry.sources.map((source) => [source.id, source]));
  const professionsByCompetency = new Map<string, string[]>();
  for (const profession of input.professionCompetencies) {
    for (const competency of profession.competencies) {
      const list = professionsByCompetency.get(competency.competencyId) ?? [];
      if (!list.includes(profession.professionId)) list.push(profession.professionId);
      professionsByCompetency.set(competency.competencyId, list);
    }
  }

  const bySource = new Map<string, string[]>();
  const byCompetency = new Map<string, string[]>();
  const usableByCompetency = new Map<string, string[]>();
  for (const competency of input.competencies.competencies) {
    const sourceIds = competency.learningSourceIds ?? [];
    if (sourceIds.length === 0) continue;
    byCompetency.set(competency.id, [...sourceIds]);
    const professions = professionsByCompetency.get(competency.id) ?? [];
    const resolved: LearningSourceRecord[] = [];
    for (const sourceId of sourceIds) {
      const source = sources.get(sourceId);
      if (!source) {
        errors.push(`${competency.id}: источник «${sourceId}» не найден в реестре`);
        continue;
      }
      resolved.push(source);
      const sourceList = bySource.get(sourceId) ?? [];
      if (!sourceList.includes(competency.id)) sourceList.push(competency.id);
      bySource.set(sourceId, sourceList);
      if (EVIDENCE_BLOCKED.has(source.status)) {
        errors.push(`${competency.id}: источник «${sourceId}» в статусе ${source.status} не может быть доказательством`);
      } else if (source.status !== "active") {
        warnings.push(`${competency.id}: источник «${sourceId}» в статусе ${source.status}, нужна перепроверка`);
      }
      const professionMatches = professions.length === 0 || source.professionIds.some((id) => professions.includes(id));
      if (!professionMatches) {
        errors.push(
          `${competency.id}: источник «${sourceId}» не объявлен для профессии ${professions.join(", ")}`,
        );
      }
      if (source.status === "active" && source.authority !== "aggregator" && professionMatches) {
        const usable = usableByCompetency.get(competency.id) ?? [];
        if (!usable.includes(sourceId)) usable.push(sourceId);
        usableByCompetency.set(competency.id, usable);
      }
    }
    const usable = resolved.filter((source) => !EVIDENCE_BLOCKED.has(source.status));
    if (usable.length > 0 && usable.every((source) => source.authority === "aggregator")) {
      warnings.push(`${competency.id}: только агрегаторы, нужен первичный источник`);
    }
  }

  const coverage: LearningSourceCoverage[] = [];
  for (const profession of input.professionCompetencies) {
    const withoutSources: string[] = [];
    let covered = 0;
    for (const competency of profession.competencies) {
      const usable = usableByCompetency.get(competency.competencyId) ?? [];
      if (usable.length > 0) covered += 1;
      else withoutSources.push(competency.competencyId);
    }
    coverage.push({ professionId: profession.professionId, total: profession.competencies.length, covered, withoutSources });
  }

  for (const source of input.registry.sources) {
    if (source.status !== "active") continue;
    const referenced = bySource.get(source.id) ?? [];
    if (referenced.length === 0) {
      warnings.push(`источник «${source.id}» активен, но не связан ни с одной компетенцией`);
    }
  }

  return { errors, warnings, bySource, byCompetency, coverage };
}

export function renderLearningSourceMapReport(result: LearningSourceMapResult, updatedAt: string): string {
  const lines: string[] = [];
  lines.push('# Учебные источники → компетенции');
  lines.push('');
  lines.push(`Обновлено: ${updatedAt}. Ошибок: ${result.errors.length}; предупреждений: ${result.warnings.length}.`);
  lines.push('');
  lines.push('## Покрытие компетенций профессий');
  lines.push('');
  lines.push('| Профессия | Компетенций | С источником | Без источника |');
  lines.push('|---|---:|---:|---|');
  for (const item of result.coverage) {
    lines.push(`| ${item.professionId} | ${item.total} | ${item.covered} | ${item.withoutSources.join(", ") || "—"} |`);
  }
  lines.push('');
  lines.push('## Источники');
  lines.push('');
  lines.push('| Источник | Компетенций |');
  lines.push('|---|---|');
  for (const [sourceId, competencyIds] of [...result.bySource.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`| ${sourceId} | ${competencyIds.join(", ")} |`);
  }
  lines.push('');
  if (result.errors.length > 0) {
    lines.push('## Ошибки');
    lines.push('');
    for (const error of result.errors) lines.push(`- ${error}`);
    lines.push('');
  }
  if (result.warnings.length > 0) {
    lines.push('## Предупреждения');
    lines.push('');
    for (const warning of result.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }
  return `${lines.join("\n")}\n`;
}
