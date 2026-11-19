import levelsRaw from "../content/generated/matrix/levels.json";
import professionsRaw from "../content/generated/matrix/professions.json";
import competenciesRaw from "../content/generated/matrix/competencies.json";
import fitRaw from "../content/generated/matrix/fit.json";
import uxuiGrades from "../content/generated/matrix/grades/uxui.json";
import productGrades from "../content/generated/matrix/grades/product.json";
import aidesignerGrades from "../content/generated/matrix/grades/aidesigner.json";
import webdesignerGrades from "../content/generated/matrix/grades/webdesigner.json";
import appdesignGrades from "../content/generated/matrix/grades/appdesign.json";
import motionGrades from "../content/generated/matrix/grades/motion.json";
import threeDGraders from "../content/generated/matrix/grades/3ddesigner.json";
import graphicGrades from "../content/generated/matrix/grades/graphic.json";
import artdirGrades from "../content/generated/matrix/grades/artdir.json";
import interiorGrades from "../content/generated/matrix/grades/interior.json";
import presentationGrades from "../content/generated/matrix/grades/presentation.json";
import uxresearchGrades from "../content/generated/matrix/grades/uxresearch.json";
import gameGrades from "../content/generated/matrix/grades/game.json";
import { findCompetency } from "./content";
import type { FitStatus, MatrixGrade, MatrixLevel } from "../../../../src/methodology/v1/matrix/logic";
export type { MatrixGrade, MatrixLevel, MatrixRequirement, MatrixSummary } from "../../../../src/methodology/v1/matrix/logic";
export { derivePlanStudyState, summarizeMatrix } from "../../../../src/methodology/v1/matrix/logic";

export interface MatrixProfession {
  slug: string;
  title: string;
  family: string;
  ready: boolean;
  order: number;
  description?: string;
}

export interface MatrixCompetencyView {
  id: string;
  title: string;
  definition: string;
  group: "universal" | "digital" | "uxui" | "product" | "ai" | "web" | "app" | "motion" | "3d" | "graphic" | "artdir" | "interior" | "presentation" | "research" | "game";
  descriptors: Record<"1" | "2" | "3" | "4", string>;
}

export interface MatrixRow extends MatrixCompetencyView {
  targetLevel: MatrixLevel;
  fit: FitStatus;
}

const levels = levelsRaw as unknown as {
  levelsVersion: string;
  levels: Array<{ code: MatrixLevel; label: string; short: string }>;
};
const professions = professionsRaw as unknown as { professionsVersion: string; professions: MatrixProfession[] };
const competencies = competenciesRaw as unknown as {
  competenciesVersion: string;
  competencies: Record<string, Omit<MatrixCompetencyView, "definition">>;
};
const fit = fitRaw as unknown as {
  fitVersion: string;
  professions: Record<string, Record<string, FitStatus>>;
};
type GradeFile = { gradesVersion: string; professionSlug: string; grades: MatrixGrade[] };
const gradeFiles: Record<string, GradeFile> = {
  uxui: uxuiGrades as unknown as GradeFile,
  product: productGrades as unknown as GradeFile,
  aidesigner: aidesignerGrades as unknown as GradeFile,
  webdesigner: webdesignerGrades as unknown as GradeFile,
  appdesign: appdesignGrades as unknown as GradeFile,
  motion: motionGrades as unknown as GradeFile,
  "3ddesigner": threeDGraders as unknown as GradeFile,
  graphic: graphicGrades as unknown as GradeFile,
  artdir: artdirGrades as unknown as GradeFile,
  interior: interiorGrades as unknown as GradeFile,
  presentation: presentationGrades as unknown as GradeFile,
  uxresearch: uxresearchGrades as unknown as GradeFile,
  game: gameGrades as unknown as GradeFile,
};

export const MATRIX_FAMILY_LABELS: Record<string, string> = {
  "digital-product": "Цифровой продукт",
  "motion-3d": "Motion и 3D",
  "visual-brand": "Визуал и бренд",
  spatial: "Пространство",
  presentation: "Презентации",
  research: "Исследования",
  game: "Игры",
};

export const MATRIX_FAMILY_ORDER = [
  "digital-product",
  "visual-brand",
  "motion-3d",
  "spatial",
  "presentation",
  "research",
  "game",
];

export function matrixFamilyLabel(family: string): string {
  return MATRIX_FAMILY_LABELS[family] ?? "Дизайн";
}

export function listMatrixFamilies(): Array<{ key: string; label: string; count: number }> {
  return MATRIX_FAMILY_ORDER.map((key) => ({
    key,
    label: matrixFamilyLabel(key),
    count: professions.professions.filter((profession) => profession.ready && profession.family === key).length,
  })).filter((item) => item.count > 0);
}

export const matrixContentVersion = [
  levels.levelsVersion,
  professions.professionsVersion,
  competencies.competenciesVersion,
  fit.fitVersion,
  ...Object.values(gradeFiles).map((file) => file.gradesVersion),
].join("+");

export function listMatrixProfessions(): MatrixProfession[] {
  return professions.professions.filter((profession) => profession.ready).sort((a, b) => a.order - b.order);
}

export function getMatrixProfession(slug: string): MatrixProfession | undefined {
  return professions.professions.find((profession) => profession.slug === slug && profession.ready);
}

export function getMatrixLevels(): Array<{ code: MatrixLevel; label: string; short: string }> {
  return levels.levels;
}

export function getMatrixGrades(professionSlug: string): MatrixGrade[] {
  return gradeFiles[professionSlug]?.grades ?? [];
}

export function getMatrixGrade(professionSlug: string, gradeCode: string): MatrixGrade | undefined {
  return getMatrixGrades(professionSlug).find((grade) => grade.code === gradeCode);
}

export function getMatrixFit(professionSlug: string, competencyId: string): FitStatus {
  return fit.professions[professionSlug]?.[competencyId] ?? "none";
}

export function getMatrixCompetency(id: string): MatrixCompetencyView | undefined {
  const source = competencies.competencies[id];
  if (!source) return undefined;
  const content = findCompetency(id)?.competency;
  return {
    id: source.id,
    title: source.title,
    definition: content?.definition ?? "",
    group: source.group,
    descriptors: source.descriptors,
  };
}

export function getMatrixRows(professionSlug: string, gradeCode: string): MatrixRow[] {
  const grade = getMatrixGrade(professionSlug, gradeCode);
  if (!grade) return [];
  const rows: MatrixRow[] = [];
  for (const requirement of grade.requirements) {
    const competency = getMatrixCompetency(requirement.competencyId);
    if (!competency) continue;
    rows.push({
      ...competency,
      targetLevel: requirement.targetLevel,
      fit: getMatrixFit(professionSlug, requirement.competencyId),
    });
  }
  return rows;
}

/** Ключевые требования грейда: 5 строк, сначала профессиональные. */
export function getGradeHighlightRows(professionSlug: string, gradeCode: string): MatrixRow[] {
  return getMatrixRows(professionSlug, gradeCode)
    .slice()
    .sort((a, b) => {
      const specific = (row: typeof a) => (row.fit === "specific" ? 0 : 1);
      return specific(a) - specific(b) || b.targetLevel - a.targetLevel || a.title.localeCompare(b.title);
    })
    .slice(0, 5);
}

/** Короткая «минималка» для карточки грейда. */
export function getGradeHighlights(professionSlug: string, gradeCode: string): string[] {
  return getGradeHighlightRows(professionSlug, gradeCode).map(
    (row) => `${row.title} — ${row.targetLevel}`,
  );
}

export function gradeLevelLabel(level: number): string {
  return levels.levels.find((item) => item.code === level)?.label ?? `Уровень ${level}`;
}
