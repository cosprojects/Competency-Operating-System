import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GlobalCompetency } from "../src/methodology/v1/competency/model/types.ts";
import type { ProfessionView } from "../src/methodology/v1/competency/model/profession-view.ts";
import { buildProfessionCompetenciesFromView, validateProfessionView } from "../src/methodology/v1/competency/model/profession-view.ts";

const competencies: GlobalCompetency[] = [
  { id: "c1", branchId: "ux", branchTitle: "UX", sectionId: "s", sectionTitle: "S", title: "Дизайн-мышление", definition: "D", priorityHint: "foundation" },
  { id: "c2", branchId: "ui", branchTitle: "UI", sectionId: "s", sectionTitle: "S", title: "Цвет", definition: "D", priorityHint: "foundation" },
  { id: "c3", branchId: "ui", branchTitle: "UI", sectionId: "s", sectionTitle: "S", title: "Метрики", definition: "D", priorityHint: "core" },
];

const view: ProfessionView = {
  viewVersion: "1.0.0",
  professionId: "it.product",
  sphereId: "it",
  title: "Продуктовый дизайнер",
  sections: [
    { id: "foundations", title: "Основы", definition: "D", competencies: [{ competencyId: "c1", tier: "foundation", order: 1 }, { competencyId: "c2", tier: "core", order: 2 }] },
    { id: "metrics", title: "Метрики", definition: "D", competencies: [{ competencyId: "c3", tier: "foundation", order: 3 }] },
  ],
};

describe("profession view", () => {
  it("переиспользует глобальные компетенции с разными tier/order", () => {
    const built = buildProfessionCompetenciesFromView(view, competencies);
    assert.equal(built.competencies.length, 3);
    assert.equal(built.competencies[1]?.competencyId, "c2");
    assert.equal(built.competencies[1]?.tier, "core");
    assert.equal(built.competencies[2]?.sectionTitle, "Метрики");
  });

  it("ловит неизвестную компетенцию и плохой order", () => {
    const bad = structuredClone(view);
    bad.sections[0]!.competencies[0]!.competencyId = "unknown";
    bad.sections[0]!.competencies[1]!.order = 1;
    const errors = validateProfessionView(bad, competencies);
    assert.ok(errors.some((error) => error.includes("неизвестная компетенция")));
    assert.ok(errors.some((error) => error.includes("повтор order")));
  });
});
