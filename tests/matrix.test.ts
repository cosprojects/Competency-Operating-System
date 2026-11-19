import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  derivePlanStudyState,
  studyProgress,
  summarizeMatrix,
  type MatrixLevel,
} from "../src/methodology/v1/matrix/logic.ts";

const root = process.cwd();
const read = (file: string) => JSON.parse(readFileSync(path.join(root, "src/methodology/v1/matrix/content", file), "utf8"));

describe("matrix content", () => {
  const professions = read("professions.json") as { professions: Array<{ slug: string; ready: boolean }> };
  const levels = read("levels.json") as { levels: Array<{ code: number; label: string }> };
  const competencies = read("competencies.json") as {
    competencies: Record<string, { descriptors: Record<string, string> }>;
  };
  const fit = read("fit.json") as { professions: Record<string, Record<string, string>> };

  it("содержит 13 профессий, 13 готовых и 5 уровней", () => {
    assert.equal(professions.professions.length, 13);
    assert.equal(professions.professions.filter((item) => item.ready).length, 13);
    assert.deepEqual(
      levels.levels.map((level) => level.code),
      [0, 1, 2, 3, 4],
    );
  });

  it("у каждой компетенции есть четыре дескриптора", () => {
    for (const [id, competency] of Object.entries(competencies.competencies)) {
      for (const level of ["1", "2", "3", "4"]) {
        assert.ok(competency.descriptors[level]?.trim(), `${id}: нет дескриптора ${level}`);
      }
    }
  });

  it("грейды готовых профессий валидны и не выходят за fit", () => {
    for (const profession of professions.professions.filter((item) => item.ready)) {
      const file = read(`grades/${profession.slug}.json`) as {
        grades: Array<{ code: string; requirements: Array<{ competencyId: string; targetLevel: number }> }>;
      };
      assert.equal(file.grades.length, 5, `${profession.slug}: грейды`);
      const statuses = fit.professions[profession.slug] ?? {};
      for (const grade of file.grades) {
        assert.ok(grade.requirements.length >= 8, `${profession.slug}/${grade.code}: мало требований`);
        for (const requirement of grade.requirements) {
          assert.ok(competencies.competencies[requirement.competencyId], `${requirement.competencyId}: нет дескрипторов`);
          assert.ok(requirement.targetLevel >= 1 && requirement.targetLevel <= 4);
          assert.ok(
            ["core", "recommended", "specific", "optional"].includes(statuses[requirement.competencyId] ?? ""),
            `${profession.slug}/${grade.code}/${requirement.competencyId}: fit`,
          );
        }
      }
    }
  });
});

describe("matrix summary", () => {
  it("делит требования на сильные стороны и разрывы", () => {
    const levels: Record<string, MatrixLevel> = { a: 3, b: 1, c: 0 };
    const summary = summarizeMatrix(
      [
        { competencyId: "a", targetLevel: 3 },
        { competencyId: "b", targetLevel: 2 },
        { competencyId: "c", targetLevel: 1 },
      ],
      levels,
      { a: "A", b: "B", c: "C" },
    );
    assert.equal(summary.total, 3);
    assert.equal(summary.met, 1);
    assert.deepEqual(
      summary.gaps.map((gap) => gap.competencyId),
      ["b", "c"],
    );
  });
});

describe("plan ↔ study", () => {
  it("не поднимает уровень по отметкам и только подсказывает переоценку", () => {
    const state = derivePlanStudyState({
      currentLevel: 2,
      targetLevel: 3,
      study: { competencyStatus: "LEARNED", learnedItems: 6, totalItems: 6, saved: true },
    });
    assert.equal(state.state, "gap");
    assert.equal(state.needsReassessment, true);
    assert.equal(state.currentLevel, 2);
  });

  it("не считает изучение уровнем", () => {
    assert.deepEqual(studyProgress({ learnedItems: 3, totalItems: 6 }), { learned: 3, total: 6, ratio: 0.5 });
    assert.equal(studyProgress({ learnedItems: 0, totalItems: 0 }).ratio, 0);
  });

  it("без матрицы не показывает план", () => {
    const state = derivePlanStudyState({
      currentLevel: null,
      targetLevel: null,
      study: { competencyStatus: "LEARNING", learnedItems: 1, totalItems: 2, saved: true },
    });
    assert.equal(state.state, "not_in_plan");
    assert.equal(state.needsReassessment, false);
  });
});
