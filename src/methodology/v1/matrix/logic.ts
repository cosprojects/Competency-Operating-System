/**
 * Чистая логика матрицы компетенций (MVP «План»).
 * Не зависит от Next.js, БД и generated-контента — покрывается unit-тестами.
 */

export type MatrixLevel = 0 | 1 | 2 | 3 | 4;

export interface MatrixRequirement {
  competencyId: string;
  targetLevel: MatrixLevel;
}

export interface MatrixGrade {
  code: string;
  title: string;
  order: number;
  scope: string;
  requirements: MatrixRequirement[];
}

export interface MatrixCompetency {
  id: string;
  title: string;
  group: "universal" | "digital" | "uxui" | "product" | "ai" | "web" | "app" | "motion" | "3d" | "graphic" | "artdir" | "interior" | "presentation" | "research" | "game";
  descriptors: Record<"1" | "2" | "3" | "4", string>;
}

export type FitStatus = "core" | "recommended" | "specific" | "optional" | "none";

export interface MatrixSummaryItem {
  competencyId: string;
  title: string;
  targetLevel: MatrixLevel;
  currentLevel: MatrixLevel;
  gap: number;
}

export interface MatrixSummary {
  total: number;
  met: number;
  gaps: MatrixSummaryItem[];
  strengths: MatrixSummaryItem[];
}

export interface StudyInput {
  competencyStatus: "NOT_STARTED" | "LEARNING" | "LEARNED";
  learnedItems: number;
  totalItems: number;
  saved: boolean;
}

export type PlanStudyState = "not_in_plan" | "gap" | "on_target";

export interface PlanStudyContext {
  state: PlanStudyState;
  currentLevel: MatrixLevel | null;
  targetLevel: MatrixLevel | null;
  learnedItems: number;
  totalItems: number;
  needsReassessment: boolean;
}

/** Сводка матрицы: закрытые требования, разрывы и сильные стороны. */
export function summarizeMatrix(
  requirements: MatrixRequirement[],
  levels: Record<string, MatrixLevel>,
  titles: Record<string, string> = {},
): MatrixSummary {
  const items: MatrixSummaryItem[] = requirements.map((requirement) => {
    const current = levels[requirement.competencyId] ?? 0;
    return {
      competencyId: requirement.competencyId,
      title: titles[requirement.competencyId] ?? requirement.competencyId,
      targetLevel: requirement.targetLevel,
      currentLevel: current,
      gap: Math.max(0, requirement.targetLevel - current),
    };
  });
  const gaps = items.filter((item) => item.gap > 0).sort((a, b) => b.gap - a.gap || a.title.localeCompare(b.title));
  const strengths = items.filter((item) => item.gap === 0).sort((a, b) => a.title.localeCompare(b.title));
  return {
    total: items.length,
    met: strengths.length,
    gaps,
    strengths,
  };
}

/**
 * Связка «Изучаю» и «План»: уровень — самооценка, изучение — активность.
 * Никакого автоповышения: needsReassessment только подсказывает проверить уровень.
 */
export function derivePlanStudyState(input: {
  currentLevel: MatrixLevel | null | undefined;
  targetLevel: MatrixLevel | null | undefined;
  study: StudyInput;
}): PlanStudyContext {
  const { currentLevel, targetLevel, study } = input;
  const learnedItems = Math.max(0, study.learnedItems);
  const totalItems = Math.max(0, study.totalItems);
  if (currentLevel == null || targetLevel == null) {
    return {
      state: "not_in_plan",
      currentLevel: null,
      targetLevel: null,
      learnedItems,
      totalItems,
      needsReassessment: false,
    };
  }
  const state: PlanStudyState = currentLevel < targetLevel ? "gap" : "on_target";
  const allItemsLearned = totalItems > 0 && learnedItems >= totalItems;
  return {
    state,
    currentLevel,
    targetLevel,
    learnedItems,
    totalItems,
    needsReassessment: state === "gap" && allItemsLearned,
  };
}

/** Прогресс изучения компетенции: только знания/навыки, без уровня. */
export function studyProgress(input: {
  learnedItems: number;
  totalItems: number;
}): { learned: number; total: number; ratio: number } {
  const learned = Math.max(0, input.learnedItems);
  const total = Math.max(0, input.totalItems);
  return { learned, total, ratio: total === 0 ? 0 : Math.min(1, learned / total) };
}

/** Проверка, что требование не выходит за fit профессии. */
export function isAllowedRequirement(fit: FitStatus | undefined): boolean {
  return fit === "core" || fit === "recommended" || fit === "specific" || fit === "optional";
}
