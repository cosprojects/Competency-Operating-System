import { getDb } from "./db";
import { findCompetency } from "./content";
import {
  getMatrixGrade,
  getMatrixProfession,
  getMatrixRows,
  matrixContentVersion,
  type MatrixProfession,
  type MatrixRow,
} from "./matrix";
import type { MatrixGrade, MatrixLevel } from "../../../../src/methodology/v1/matrix/logic";

export interface StudyProgress {
  status: "NOT_STARTED" | "LEARNING" | "LEARNED";
  learnedItems: number;
  totalItems: number;
  saved: boolean;
}

export interface PlanContext {
  professionSlug: string;
  professionTitle: string;
  gradeCode: string;
  gradeTitle: string;
  currentLevel: MatrixLevel;
  targetLevel: MatrixLevel;
  stale: boolean;
}

export interface LatestMatrix {
  id: string;
  createdAt: Date;
  profession: MatrixProfession;
  grade: MatrixGrade;
  rows: MatrixRow[];
  levels: Record<string, MatrixLevel>;
  stale: boolean;
}

function parseLevels(raw: string): Record<string, MatrixLevel> {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, MatrixLevel> = {};
    for (const [key, level] of Object.entries(value)) {
      if (level === 0 || level === 1 || level === 2 || level === 3 || level === 4) result[key] = level;
    }
    return result;
  } catch {
    return {};
  }
}

/** Последняя матрица пользователя. */
export async function getLatestMatrix(userId: string): Promise<LatestMatrix | null> {
  const db = getDb();
  const run = await db.matrixRun.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!run) return null;
  const profession = getMatrixProfession(run.professionSlug);
  const grade = getMatrixGrade(run.professionSlug, run.gradeCode);
  if (!profession || !grade) return null;
  return {
    id: run.id,
    createdAt: run.createdAt,
    profession,
    grade,
    rows: getMatrixRows(run.professionSlug, run.gradeCode),
    levels: parseLevels(run.levelsJson),
    stale: run.contentVersion !== matrixContentVersion,
  };
}

/** Прогресс изучения по компетенциям: отметки знаний/навыков и сохранение. */
export async function loadStudyProgress(
  userId: string,
  competencyIds: string[],
): Promise<Record<string, StudyProgress>> {
  const result: Record<string, StudyProgress> = {};
  if (competencyIds.length === 0) return result;
  const itemIds: string[] = [];
  const itemOwner = new Map<string, string>();
  for (const competencyId of competencyIds) {
    const context = findCompetency(competencyId);
    if (!context) continue;
    for (const item of [...context.competency.knowledge, ...context.competency.skills]) {
      itemIds.push(item.id);
      itemOwner.set(item.id, competencyId);
    }
  }
  const db = getDb();
  const [marks, statuses, favorites] = await Promise.all([
    itemIds.length > 0
      ? db.studyMark.findMany({
          where: { userId, targetType: { in: ["KNOWLEDGE", "SKILL"] }, targetId: { in: itemIds }, status: "LEARNED" },
          select: { targetId: true },
        })
      : Promise.resolve([]),
    db.studyStatus.findMany({
      where: { userId, competencyId: { in: competencyIds } },
      select: { competencyId: true, status: true },
    }),
    db.favorite.findMany({
      where: { userId, targetType: "COMPETENCY", targetId: { in: competencyIds } },
      select: { targetId: true },
    }),
  ]);
  const learnedByCompetency = new Map<string, number>();
  for (const mark of marks) {
    const owner = itemOwner.get(mark.targetId);
    if (!owner) continue;
    learnedByCompetency.set(owner, (learnedByCompetency.get(owner) ?? 0) + 1);
  }
  const statusByCompetency = new Map(statuses.map((item) => [item.competencyId, item.status]));
  const saved = new Set(favorites.map((item) => item.targetId));
  for (const competencyId of competencyIds) {
    const context = findCompetency(competencyId);
    const totalItems = context ? context.competency.knowledge.length + context.competency.skills.length : 0;
    result[competencyId] = {
      status: statusByCompetency.get(competencyId) ?? "NOT_STARTED",
      learnedItems: learnedByCompetency.get(competencyId) ?? 0,
      totalItems,
      saved: saved.has(competencyId),
    };
  }
  return result;
}

/** Контекст плана по компетенциям для карточек «Изучаю». */
export async function loadPlanContext(
  userId: string,
  competencyIds: string[],
): Promise<Record<string, PlanContext>> {
  const latest = await getLatestMatrix(userId);
  if (!latest) return {};
  const result: Record<string, PlanContext> = {};
  for (const competencyId of competencyIds) {
    const row = latest.rows.find((item) => item.id === competencyId);
    if (!row) continue;
    result[competencyId] = {
      professionSlug: latest.profession.slug,
      professionTitle: latest.profession.title,
      gradeCode: latest.grade.code,
      gradeTitle: latest.grade.title,
      currentLevel: latest.levels[competencyId] ?? 0,
      targetLevel: row.targetLevel,
      stale: latest.stale,
    };
  }
  return result;
}
