import type { TagRecord } from "../types.ts";
import { normalizeTitle } from "../sources/common.ts";
import type {
  MappingCoverage,
  MappingSupport,
  MappingValidationInput,
  MappingValidationResult,
  TagMappingFile,
} from "./types.ts";
import { supportOf } from "./types.ts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAPPABLE_KINDS = new Set(["knowledge", "skill"]);

function viewCompetencyIds(input: MappingValidationInput): string[] {
  const ids: string[] = [];
  for (const section of input.view.sections) {
    for (const competency of section.competencies) ids.push(competency.competencyId);
  }
  return ids;
}

/**
 * Проверяет сопоставление собранных product-тегов компетенциям profession view.
 *
 * Правила:
 * - каждая компетенция view описана ровно один раз (иначе часть графа не проверена);
 * - direct/adjacent требуют хотя бы одного тега, support "none" — пустой список и rationale;
 * - теги должны существовать в собранном наборе и быть knowledge/skill (tool не доказательство);
 * - тег нельзя одновременно использовать и исключать;
 * - excludedTags существуют в собранном наборе.
 */
export function validateTagMapping(input: MappingValidationInput): MappingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { mapping, view, tags } = input;
  const competencyIds = viewCompetencyIds(input);
  const competencySet = new Set(competencyIds);

  if (mapping.mappingVersion !== "1.0.0") errors.push("mapping: неверная mappingVersion");
  if (!mapping.domain) errors.push("mapping: не задан domain");
  if (!mapping.professionId) errors.push("mapping: не задан professionId");
  if (mapping.professionId !== view.professionId) {
    errors.push(`mapping: professionId «${mapping.professionId}» не совпадает с view «${view.professionId}»`);
  }
  if (!DATE.test(mapping.updatedOn)) errors.push("mapping: updatedOn должен быть YYYY-MM-DD");
  if (mapping.status !== "draft" && mapping.status !== "accepted") {
    errors.push("mapping: status должен быть draft или accepted");
  }

  const tagsByTitle = new Map<string, TagRecord>();
  for (const tag of tags ?? []) {
    const key = normalizeTitle(tag.title);
    if (!tagsByTitle.has(key)) tagsByTitle.set(key, tag);
  }
  const hasTagsFile = Boolean(tags && tags.length > 0);
  if (!hasTagsFile) {
    warnings.push("mapping: собранные теги не переданы, названия тегов не проверены");
  }

  const byCompetency = new Map<string, MappingSupport>();
  const usedTagTitles: string[] = [];
  const unresolvedTagTitles: string[] = [];
  for (const entry of mapping.entries) {
    const prefix = `mapping «${entry.competencyId}»`;
    if (!competencySet.has(entry.competencyId)) {
      errors.push(`${prefix}: компетенции нет в profession view`);
    }
    if (byCompetency.has(entry.competencyId)) errors.push(`${prefix}: повтор записи`);
    const support = supportOf(entry);
    byCompetency.set(entry.competencyId, support);
    if (!entry.rationale || entry.rationale.trim().length < 10) {
      errors.push(`${prefix}: rationale короче 10 символов`);
    }
    if (support !== "none" && entry.tags.length === 0) {
      errors.push(`${prefix}: нет ни одного тега`);
    }
    const seen = new Set<string>();
    for (const tag of entry.tags) {
      const key = normalizeTitle(tag.title);
      if (!key) errors.push(`${prefix}: пустое название тега`);
      if (seen.has(key)) errors.push(`${prefix}: повтор тега «${tag.title}»`);
      seen.add(key);
      if (tag.relation !== "direct" && tag.relation !== "adjacent") {
        errors.push(`${prefix}: недопустимая relation у «${tag.title}»`);
      }
      usedTagTitles.push(tag.title);
      if (hasTagsFile) {
        const resolved = tagsByTitle.get(key);
        if (!resolved) {
          unresolvedTagTitles.push(tag.title);
          errors.push(`${prefix}: тег «${tag.title}» не найден в собранном наборе`);
        } else if (!MAPPABLE_KINDS.has(resolved.kind)) {
          errors.push(`${prefix}: тег «${tag.title}» имеет kind ${resolved.kind}, инструмент не является доказательством`);
        }
      }
    }
  }

  for (const competencyId of competencyIds) {
    if (!byCompetency.has(competencyId)) {
      errors.push(`mapping: компетенция «${competencyId}» не сопоставлена ни с одним тегом`);
    }
  }

  const excludedByTitle = new Map<string, string>();
  for (const excluded of mapping.excludedTags ?? []) {
    const key = normalizeTitle(excluded.title);
    if (!key) errors.push("mapping: пустое название исключённого тега");
    if (excludedByTitle.has(key)) errors.push(`mapping: повтор исключённого тега «${excluded.title}»`);
    excludedByTitle.set(key, excluded.reason);
    if (!excluded.reason || excluded.reason.trim().length < 10) {
      errors.push(`mapping «${excluded.title}»: reason короче 10 символов`);
    }
    if (hasTagsFile && !tagsByTitle.has(key)) {
      warnings.push(`mapping: исключённый тег «${excluded.title}» не найден в собранном наборе`);
    }
    if (usedTagTitles.some((title) => normalizeTitle(title) === key)) {
      errors.push(`mapping: тег «${excluded.title}» одновременно использован и исключён`);
    }
  }

  const unaccounted = new Map<string, string>();
  if (hasTagsFile) {
    const usedKeys = new Set(usedTagTitles.map((title) => normalizeTitle(title)));
    for (const [key, tag] of tagsByTitle) {
      if (!MAPPABLE_KINDS.has(tag.kind)) continue;
      if (!usedKeys.has(key) && !excludedByTitle.has(key)) unaccounted.set(key, tag.title);
    }
    if (unaccounted.size > 0) {
      warnings.push(
        `mapping: теги без решения (не использованы и не исключены): ${[...unaccounted.values()].join(", ")}`,
      );
    }
  }

  const coverage: MappingCoverage = {
    competencies: competencyIds.length,
    direct: [...byCompetency.values()].filter((value) => value === "direct").length,
    adjacent: [...byCompetency.values()].filter((value) => value === "adjacent").length,
    none: [...byCompetency.values()].filter((value) => value === "none").length,
    byCompetency,
  };
  if (coverage.none > 0) {
    warnings.push(`mapping: без доказательств ${coverage.none} из ${coverage.competencies} компетенций`);
  }

  return { errors, warnings, coverage, usedTagTitles, unresolvedTagTitles, unaccountedTagTitles: [...unaccounted.values()] };
}

/** Markdown-отчёт: покрытие по компетенциям и использование тегов. */
export function renderTagMappingReport(
  input: MappingValidationInput,
  result: MappingValidationResult,
): string {
  const { mapping } = input;
  const titles = input.titles ?? {};
  const lines: string[] = [];
  lines.push(`# Сопоставление product-тегов и компетенций — ${mapping.professionId}`);
  lines.push("");
  lines.push(`Статус: ${mapping.status}; обновлено: ${mapping.updatedOn}.`);
  lines.push("");
  lines.push(`Компетенций: ${result.coverage.competencies}; direct: ${result.coverage.direct}; adjacent: ${result.coverage.adjacent}; без product-доказательств: ${result.coverage.none}.`);
  lines.push("");
  lines.push("| Компетенция | Support | Теги |");
  lines.push("|---|---|---|");
  for (const entry of mapping.entries) {
    const support = result.coverage.byCompetency.get(entry.competencyId) ?? "none";
    const tags = entry.tags.map((tag) => `${tag.title} (${tag.relation})`).join(", ");
    lines.push(`| ${titles[entry.competencyId] ?? entry.competencyId} | ${support} | ${tags || "—"} |`);
  }
  lines.push("");
  if (result.usedTagTitles.length > 0) {
    lines.push(`Использовано тегов: ${[...new Set(result.usedTagTitles)].length}.`);
  }
  if ((mapping.excludedTags ?? []).length > 0) {
    lines.push("");
    lines.push("## Исключённые теги");
    lines.push("");
    for (const excluded of mapping.excludedTags ?? []) lines.push(`- ${excluded.title} — ${excluded.reason}`);
  }
  for (const warning of result.warnings) lines.push(`> warning: ${warning}`);
  for (const error of result.errors) lines.push(`> error: ${error}`);
  return `${lines.join("\n")}\n`;
}
