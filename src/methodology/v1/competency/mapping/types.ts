import type { TagRecord } from "../types.ts";
import type { ProfessionView } from "../model/profession-view.ts";

export type MappingRelation = "direct" | "adjacent";
export type MappingSupport = MappingRelation | "none";

export interface MappingTagEntry {
  /** Название собранного тега (knowledge/skill). Совпадение по нормализованному названию. */
  title: string;
  relation: MappingRelation;
}

export interface MappingEntry {
  competencyId: string;
  /** Подтверждающие product-теги профессии. Пусто при support = "none". */
  tags: MappingTagEntry[];
  /** Почему выбран такой уровень подтверждения; обязателен для support = "none". */
  rationale: string;
}

export interface MappingExcludedTag {
  title: string;
  reason: string;
}

export interface TagMappingFile {
  mappingVersion: "1.0.0";
  domain: string;
  professionId: string;
  updatedOn: string;
  status: "draft" | "accepted";
  description?: string;
  entries: MappingEntry[];
  excludedTags?: MappingExcludedTag[];
}

export interface MappingValidationInput {
  mapping: TagMappingFile;
  view: ProfessionView;
  tags?: TagRecord[];
  /** Названия компетенций для отчёта; необязательно. */
  titles?: Record<string, string>;
}

export interface MappingCoverage {
  competencies: number;
  direct: number;
  adjacent: number;
  none: number;
  byCompetency: Map<string, MappingSupport>;
}

export interface MappingValidationResult {
  errors: string[];
  warnings: string[];
  coverage: MappingCoverage;
  usedTagTitles: string[];
  unresolvedTagTitles: string[];
  /** Собранные knowledge/skill-теги, для которых нет решения: ни mapping, ни excluded. */
  unaccountedTagTitles: string[];
}

export function supportOf(entry: MappingEntry): MappingSupport {
  if (entry.tags.some((tag) => tag.relation === "direct")) return "direct";
  if (entry.tags.length > 0) return "adjacent";
  return "none";
}
