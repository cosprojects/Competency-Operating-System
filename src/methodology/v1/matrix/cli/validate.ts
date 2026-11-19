import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { FitStatus, MatrixGrade, MatrixLevel } from "../logic.ts";

const root = process.cwd();
const base = path.join(root, "src/methodology/v1/matrix/content");
const errors: string[] = [];
const warnings: string[] = [];

interface Profession {
  slug: string;
  title: string;
  family: string;
  ready: boolean;
  order: number;
}

interface Competency {
  id: string;
  title: string;
  group: string;
  descriptors: Record<string, string>;
}

interface FitFile {
  professions: Record<string, Record<string, FitStatus>>;
}

interface GradeFile {
  professionSlug: string;
  grades: MatrixGrade[];
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(base, file), "utf8")) as T;
}

function fail(message: string): void {
  errors.push(message);
}

function isLevel(value: unknown): value is MatrixLevel {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4;
}

const professionsFile = await readJson<{ professions: Profession[] }>("professions.json");
const levelsFile = await readJson<{ levels: Array<{ code: number; label: string }> }>("levels.json");
const competenciesFile = await readJson<{ competencies: Record<string, Competency> }>("competencies.json");
const fitFile = await readJson<FitFile>("fit.json");
const reviewFile = await readJson<{
  status: string;
  reviewedAt: string;
  scope: { professions: number; competencies: number; grades: number };
}>("review.json");

const professions = professionsFile.professions;
const competencies = competenciesFile.competencies;
const slugs = new Set(professions.map((item) => item.slug));

if (new Set(professions.map((item) => item.slug)).size !== professions.length) fail("professions.json: дубли slug");
if (reviewFile.status !== "approved-for-mvp") fail(`review.json: статус ${reviewFile.status}, ожидается approved-for-mvp`);
if (reviewFile.scope.professions !== professions.length) fail("review.json: число профессий не совпадает");
if (reviewFile.scope.competencies !== Object.keys(competencies).length) fail("review.json: число компетенций не совпадает");
if (reviewFile.scope.grades !== professions.filter((item) => item.ready).length * 5) fail("review.json: число грейдов не совпадает");

if (levelsFile.levels.length !== 5) fail(`levels.json: ожидается 5 уровней, получено ${levelsFile.levels.length}`);
if (!levelsFile.levels.every((level) => isLevel(level.code) && level.label.trim())) fail("levels.json: уровни 0–4 и подписи обязательны");

for (const [id, competency] of Object.entries(competencies)) {
  if (competency.id !== id) fail(`competencies.json: ключ ${id} не совпадает с id ${competency.id}`);
  if (!competency.title.trim()) fail(`competencies.json: ${id}: пустой title`);
  for (const level of [1, 2, 3, 4]) {
    const text = competency.descriptors[String(level)];
    if (!text || !text.trim()) fail(`competencies.json: ${id}: нет дескриптора уровня ${level}`);
  }
}

const validStatuses = new Set<FitStatus>(["core", "recommended", "specific", "optional", "none"]);
for (const [slug, entries] of Object.entries(fitFile.professions)) {
  if (!slugs.has(slug)) fail(`fit.json: неизвестная профессия ${slug}`);
  for (const [competencyId, status] of Object.entries(entries)) {
    if (!competencies[competencyId]) fail(`fit.json: ${slug}: неизвестная компетенция ${competencyId}`);
    if (!validStatuses.has(status)) fail(`fit.json: ${slug}/${competencyId}: неверный статус ${status}`);
  }
}

interface GeneratedContent {
  professions: Array<{ slug: string; sections: Array<{ competencies: Array<{ id: string }> }> }>;
}

let generatedContent: GeneratedContent | null = null;
try {
  generatedContent = JSON.parse(
    await readFile(path.join(root, "apps/web/src/content/generated/beta-1.json"), "utf8"),
  ) as GeneratedContent;
} catch {
  warnings.push("generated/beta-1.json не найден — проверка доступности компетенций по профессии пропущена");
}

const availability = new Map<string, Set<string>>();
if (generatedContent) {
  for (const profession of generatedContent.professions) {
    availability.set(
      profession.slug,
      new Set(profession.sections.flatMap((section) => section.competencies.map((competency) => competency.id))),
    );
  }
}

const gradeCodes = ["intern", "junior", "designer", "senior", "lead"];
for (const profession of professions.filter((item) => item.ready)) {
  const file = `grades/${profession.slug}.json`;
  let gradeFile: GradeFile;
  try {
    gradeFile = await readJson<GradeFile>(file);
  } catch {
    fail(`${file}: файл не найден для ready-профессии ${profession.slug}`);
    continue;
  }
  if (gradeFile.professionSlug !== profession.slug) fail(`${file}: professionSlug не совпадает`);
  if (gradeFile.grades.length !== 5) fail(`${file}: ожидается 5 грейдов`);
  if (gradeFile.grades.map((grade) => grade.code).join(",") !== gradeCodes.join(",")) {
    fail(`${file}: порядок грейдов должен быть ${gradeCodes.join(", ")}`);
  }
  const fit = fitFile.professions[profession.slug] ?? {};
  const available = availability.get(profession.slug);
  const targets = new Map<string, number>();
  for (const grade of gradeFile.grades) {
    if (!grade.title.trim() || !grade.scope.trim()) fail(`${file}/${grade.code}: нужны title и scope`);
    if (grade.requirements.length < 8 || grade.requirements.length > 30) {
      fail(`${file}/${grade.code}: ожидается 8–30 требований, получено ${grade.requirements.length}`);
    }
    const ids = new Set<string>();
    for (const requirement of grade.requirements) {
      if (ids.has(requirement.competencyId)) fail(`${file}/${grade.code}: дубль ${requirement.competencyId}`);
      ids.add(requirement.competencyId);
      if (!competencies[requirement.competencyId]) fail(`${file}/${grade.code}: нет компетенции ${requirement.competencyId}`);
      if (!isLevel(requirement.targetLevel) || requirement.targetLevel === 0) {
        fail(`${file}/${grade.code}/${requirement.competencyId}: targetLevel должен быть 1–4`);
      }
      const status = fit[requirement.competencyId];
      if (!status || status === "none") {
        fail(`${file}/${grade.code}/${requirement.competencyId}: fit не допускает требование (${status ?? "none"})`);
      }
      if (available && !available.has(requirement.competencyId)) {
        fail(`${file}/${grade.code}/${requirement.competencyId}: компетенции нет в профессии ${profession.slug}`);
      }
      const previous = targets.get(requirement.competencyId);
      if (previous !== undefined && requirement.targetLevel < previous) {
        fail(`${file}: ${requirement.competencyId}: цель падает с ${previous} до ${requirement.targetLevel}`);
      }
      targets.set(requirement.competencyId, requirement.targetLevel);
    }
  }
  const core = Object.values(fit).filter((status) => status === "core" || status === "recommended").length;
  const specific = Object.values(fit).filter((status) => status === "specific").length;
  if (core < 8) fail(`fit.json/${profession.slug}: слишком мало core/recommended (${core})`);
  if (specific < 5) fail(`fit.json/${profession.slug}: слишком мало specific (${specific})`);
}

for (const warning of warnings) console.warn(`warn: ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`error: ${error}`);
  console.error(`matrix:validate: FAIL (${errors.length})`);
  process.exitCode = 1;
} else {
  console.log(
    `matrix:validate: PASS; профессий ${professions.length}; ready ${professions.filter((p) => p.ready).length}; ` +
      `компетенций ${Object.keys(competencies).length}; review ${reviewFile.status}`,
  );
}
