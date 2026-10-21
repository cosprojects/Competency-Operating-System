import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GlobalCompetency } from "../src/methodology/v1/competency/model/types.ts";
import type { ProfessionView } from "../src/methodology/v1/competency/model/profession-view.ts";
import { buildProfessionNetworkPage } from "../src/methodology/v1/competency/visualization/profession-network.ts";

const competencies: GlobalCompetency[] = [
  { id: "c1", branchId: "motion", branchTitle: "Motion", sectionId: "s1", sectionTitle: "Motion", title: "Тайминг", definition: "Тайминг", priorityHint: "foundation" },
  { id: "c2", branchId: "motion", branchTitle: "Motion", sectionId: "s1", sectionTitle: "Motion", title: "Сторибординг", definition: "Сторибординг", priorityHint: "core" },
  { id: "c3", branchId: "ui", branchTitle: "UI", sectionId: "s2", sectionTitle: "UI", title: "Framer", definition: "Framer", priorityHint: "core" },
];
const view: ProfessionView = {
  viewVersion: "1.0.0", professionId: "it.motion", sphereId: "it", title: "Моушн-дизайнер",
  sections: [
    { id: "craft", title: "Кинетика", definition: "Движение", competencies: [
      { competencyId: "c1", tier: "foundation", order: 1 },
      { competencyId: "c2", tier: "core", order: 2 },
    ] },
    { id: "tools", title: "Инструменты", definition: "Инструменты", competencies: [
      { competencyId: "c3", tier: "core", order: 3 },
    ] },
  ],
};

describe("profession network", () => {
  it("строит сеть из view с рёбрами внутри разделов", () => {
    const data = buildProfessionNetworkPage(view, competencies, [], "2026-10-21");
    assert.equal(data.nodes.length, 3);
    assert.equal(data.edges.length, 1);
    assert.equal(data.title, "Моушн-дизайнер");
    assert.equal(data.counts.foundation, 1);
    assert.ok(data.nodes.some((node) => node.section === "Кинетика"));
  });
});
