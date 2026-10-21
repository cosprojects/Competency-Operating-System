import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProfessionView } from "../src/methodology/v1/competency/model/profession-view.ts";
import type { GlobalCompetency } from "../src/methodology/v1/competency/model/types.ts";
import { buildProfessionMapPageData, renderProfessionMapPage } from "../src/methodology/v1/competency/visualization/profession-page.ts";

const view: ProfessionView = {
  viewVersion: "1.0.0", professionId: "it.motion", sphereId: "it", title: "Моушн-дизайнер",
  sections: [{
    id: "motion-craft", title: "Кинетика", definition: "Движение",
    competencies: [{ competencyId: "ui-motion", tier: "foundation", order: 1 }, { competencyId: "ui-color", tier: "core", order: 2 }],
  }],
};
const competencies: GlobalCompetency[] = [
  { id: "ui-motion", branchId: "ui", branchTitle: "UI", sectionId: "s", sectionTitle: "S", title: "Моушн", definition: "Движение", priorityHint: "core" },
  { id: "ui-color", branchId: "ui", branchTitle: "UI", sectionId: "s", sectionTitle: "S", title: "Цвет", definition: "Цвет", priorityHint: "foundation" },
];

describe("profession map page", () => {
  it("переиспользует компетенции и показывает per-profession tier", () => {
    const data = buildProfessionMapPageData(view, competencies, "2026-10-21");
    assert.equal(data.sections[0]?.competencies.length, 2);
    assert.equal(data.sections[0]?.competencies[0]?.tier, "foundation");
    assert.equal(data.counts.foundation, 1);
    assert.equal(data.counts.core, 1);
    const html = renderProfessionMapPage(data);
    assert.match(html, /Моушн-дизайнер/);
    assert.match(html, /Кинетика/);
    assert.match(html, /tier-foundation/);
  });
});
