import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CanonicalMap } from "../src/methodology/v1/competency/canonical/types.ts";
import { buildCompetencies, buildProfessionCompetencies, buildSphere } from "../src/methodology/v1/competency/model/build.ts";
import { validateModel } from "../src/methodology/v1/competency/model/validate.ts";

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
});
