import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CanonicalMap } from "../src/methodology/v1/competency/canonical/types.ts";
import { applyLearningSourceLinks, buildCompetencies, buildProfessionCompetencies, buildSphere } from "../src/methodology/v1/competency/model/build.ts";
import { validateModel, validateProfessionPrerequisites } from "../src/methodology/v1/competency/model/validate.ts";

const map: CanonicalMap = {
  canonicalVersion: "0.1.0",
  domain: "it",
  professionId: "it.uxui",
  updatedOn: "2026-10-21",
  status: "accepted",
  principles: [],
  branches: [
    {
      id: "ux", order: 1, title: "UX", definition: "Опыт",
      sections: [{
        id: "research", order: 1, title: "Исследования", definition: "Исследования",
        competencies: [
          { id: "c1", order: 1, title: "Дизайн-мышление", definition: "Определение", priorityHint: "foundation", status: "covered", coveredBy: ["b1"] },
          { id: "c2", order: 2, title: "Интервью", definition: "Определение", priorityHint: "core", status: "covered", coveredBy: ["b2"] },
        ],
      }],
    },
    {
      id: "ui", order: 2, title: "UI", definition: "Интерфейс",
      sections: [{
        id: "visual", order: 1, title: "Визуальные основы", definition: "Визуал",
        competencies: [{ id: "c3", order: 1, title: "Цвет", definition: "Определение", priorityHint: "foundation", status: "covered", coveredBy: ["b3"] }],
      }],
    },
  ],
  excludedBlocks: [],
};

describe("normalized model", () => {
  it("строит единый массив компетенций и связку профессии", () => {
    const competencies = buildCompetencies(map);
    assert.equal(competencies.competencies.length, 3);
    const profession = buildProfessionCompetencies(map, "it.uxui");
    assert.equal(profession.competencies.length, 3);
    assert.deepEqual(profession.competencies[1]?.prerequisites, ["c1"]);
    assert.equal(buildSphere().spheres[0]?.id, "it");
  });

  it("валидирует ссылки и ловит неизвестную компетенцию", () => {
    const competencies = buildCompetencies(map);
    const professionCompetencies = buildProfessionCompetencies(map, "it.uxui");
    const errors = validateModel({
      spheres: buildSphere(),
      professions: { modelVersion: "1.0.0", professions: [{ id: "it.uxui", sphereId: "it", title: "UX/UI", canonicalMapFile: "canonical/uxui.json", catalogFile: "catalog/it.json", priorityFile: "priority/uxui.json", sourcesFile: "sources/professions/it.uxui.json" }] },
      competencies,
      professionCompetencies,
    });
    assert.deepEqual(errors, []);
    professionCompetencies.competencies.push({ competencyId: "unknown", tier: "core", order: 99, prerequisites: [] });
    const bad = validateModel({
      spheres: buildSphere(),
      professions: { modelVersion: "1.0.0", professions: [{ id: "it.uxui", sphereId: "it", title: "UX/UI", canonicalMapFile: "canonical/uxui.json", catalogFile: "catalog/it.json", priorityFile: "priority/uxui.json", sourcesFile: "sources/professions/it.uxui.json" }] },
      competencies,
      professionCompetencies,
    });
    assert.ok(bad.some((error) => error.includes("неизвестная компетенция")));
  });

  it("с --require-blocks требует accepted-блок для каждой компетенции профессии", () => {
    const competencies = buildCompetencies(map);
    const professionCompetencies = buildProfessionCompetencies(map, "it.uxui");
    const professions = { modelVersion: "1.0.0" as const, professions: [{ id: "it.uxui", sphereId: "it", title: "UX/UI", canonicalMapFile: "canonical/uxui.json", catalogFile: "catalog/it.json", priorityFile: "priority/uxui.json", sourcesFile: "sources/professions/it.uxui.json" }] };
    const block = (id: string, canonicalIds: string[]) => ({
      id, slug: id, title: id, aliases: [], definition: "D", scope: "universal" as const,
      canonicalIds, professionIds: ["it.uxui"], components: [], tags: [], sourceRefs: [],
      evidenceState: "supported" as const, status: "accepted" as const,
      llmMeta: { promptVersion: "t", model: "t", inputHash: "t", costUsd: 0 }, issues: [], methodologyVersion: "0.1.0",
    });
    const withoutBlocks = validateModel({ spheres: buildSphere(), professions, competencies, professionCompetencies, requireBlocks: true, blocks: [] });
    assert.ok(withoutBlocks.some((error) => error.includes("нет accepted-блока")));
    const withBlocks = validateModel({
      spheres: buildSphere(), professions, competencies, professionCompetencies, requireBlocks: true,
      blocks: [block("b1", ["c1"]), block("b2", ["c2"]), block("b3", ["c3"])],
    });
    assert.deepEqual(withBlocks, []);
  });

  it("проверяет циклы и порядок prerequisites в слое профессии", () => {
    const competencies = buildCompetencies(map);
    const professionCompetencies = buildProfessionCompetencies(map, "it.uxui");
    professionCompetencies.competencies[0]!.prerequisites = ["c3"];
    professionCompetencies.competencies[2]!.prerequisites = ["c1"];
    const errors = validateProfessionPrerequisites(professionCompetencies);
    assert.ok(errors.some((error) => error.includes("цикл prerequisites")));
    const late = structuredClone(professionCompetencies);
    late.competencies[0]!.prerequisites = ["c2"];
    assert.ok(validateProfessionPrerequisites(late).some((error) => error.includes("не раньше order")));
    assert.deepEqual(validateProfessionPrerequisites(buildProfessionCompetencies(map, "it.uxui")), []);
  });
});

describe("learning source links", () => {
  it("мержит ссылки в единый массив без дублей и переживает пересборку", () => {
    const competencies = buildCompetencies(map);
    competencies.competencies[0]!.learningSourceIds = ["s1"];
    const applied = applyLearningSourceLinks(competencies, [
      { competencyId: "c1", sourceIds: ["s1", "s2"] },
      { competencyId: "c2", sourceIds: ["s3"] },
    ]);
    assert.deepEqual(applied.errors, []);
    assert.deepEqual(applied.competencies.competencies[0]?.learningSourceIds, ["s1", "s2"]);
    assert.deepEqual(applied.competencies.competencies[1]?.learningSourceIds, ["s3"]);
    const rebuilt = buildCompetencies(map);
    const reapplied = applyLearningSourceLinks(rebuilt, [
      { competencyId: "c1", sourceIds: ["s1", "s2"] },
    ]);
    assert.deepEqual(reapplied.competencies.competencies[0]?.learningSourceIds, ["s1", "s2"]);
  });

  it("ловит ссылку на неизвестную компетенцию", () => {
    const applied = applyLearningSourceLinks(buildCompetencies(map), [
      { competencyId: "unknown-competency", sourceIds: ["s1"] },
    ]);
    assert.ok(applied.errors.some((error) => error.includes("неизвестная компетенция")));
  });
});
