import type { CompetencyBlock } from "../types.ts";

export type StudyPriorityTier = "foundation" | "core" | "optional";

export interface StudyPrioritySignals {
  scope?: "universal" | "profession";
  professionCoverage?: number;
  graphNodeIds?: string[];
}

export interface StudyPriorityMark {
  competencyId: string;
  tier: StudyPriorityTier;
  order: number;
  prerequisites: string[];
  rationale: string;
  confidence: "high" | "medium" | "low";
  reviewer: string;
  reviewedAt: string;
  signals?: StudyPrioritySignals;
}

export interface PriorityFile {
  priorityVersion: "1.0.0";
  domain: string;
  professionId: string;
  updatedOn: string;
  status: "draft" | "accepted";
  marks: StudyPriorityMark[];
}

export interface PriorityValidationOptions {
  blocks: CompetencyBlock[];
  requireComplete?: boolean;
  requireAccepted?: boolean;
}

export interface PriorityValidationResult {
  errors: string[];
  warnings: string[];
  marksByCompetency: Map<string, StudyPriorityMark>;
  missingCompetencyIds: string[];
}

export interface PriorityTemplateRow {
  competencyId: string;
  title: string;
  blockStatus: CompetencyBlock["status"];
  components: number;
  tags: number;
  existingMark?: StudyPriorityMark;
}

export interface PriorityTemplate {
  templateVersion: "1.0.0";
  domain: string;
  professionId: string;
  source: "catalog" | "review";
  generatedOn: string;
  tiers: Array<{ id: StudyPriorityTier; label: string; meaning: string; canvasZone: string }>;
  rows: PriorityTemplateRow[];
  instructions: string[];
}

export const TIER_ORDER: Record<StudyPriorityTier, number> = {
  foundation: 0,
  core: 1,
  optional: 2,
};

export const TIER_LABELS: Record<StudyPriorityTier, string> = {
  foundation: "Фундаментальная",
  core: "Основная",
  optional: "Необязательная",
};

export const TIER_MEANINGS: Record<StudyPriorityTier, string> = {
  foundation: "Без неё нельзя осваивать основные компетенции; база профессии.",
  core: "Обязательна для работы в профессии, но не является фундаментом для остальных.",
  optional: "Специализация или смежная тема; можно пропустить без блокировки основных.",
};

export const CANVAS_ZONES: Record<StudyPriorityTier, string> = {
  foundation: "центр, крупная карточка",
  core: "внутреннее кольцо",
  optional: "внешнее кольцо, приглушённая карточка",
};
