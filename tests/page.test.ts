import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompetencyBlock } from "../src/methodology/v1/competency/types.ts";
import type { StudyPriorityMark } from "../src/methodology/v1/competency/priority/types.ts";
import { layoutCompetencies } from "../src/methodology/v1/competency/canvas/layout.ts";
import { buildVisualizationPageData, renderCanvasPage } from "../src/methodology/v1/competency/visualization/page.ts";
import type { VisualizationConfig } from "../src/methodology/v1/competency/visualization/types.ts";

function block(id: string, title: string, definition: string): CompetencyBlock {
  return {
    id,
    slug: id,
    title,
    aliases: [],
    definition,
    scope: "profession",
    professionIds: ["it.uxui"],
    components: [{ id: `${id}.a`, slug: "a", title: "Компонент", definition: "Описание", order: 1, tagIds: [] }],
    tags: [],
    sourceRefs: [],
    evidenceState: "needs_review",
    status: "needs_review",
    llmMeta: { promptVersion: "v", model: "m", inputHash: "h", costUsd: 0 },
    issues: [],
    methodologyVersion: "0.1.0",
  };
}

function mark(id: string, tier: StudyPriorityMark["tier"], order: number, prerequisites: string[] = []): StudyPriorityMark {
  return {
    competencyId: id,
    tier,
    order,
    prerequisites,
    rationale: "Короткое обоснование для визуализации.",
    confidence: "low",
    reviewer: "visual-draft",
    reviewedAt: "2026-10-21",
  };
}

describe("visualization page", () => {
  it("собирает данные страницы и рисует карточки/связи", () => {
    const blocks = [block("f", "Теория цвета", "Цвет и восприятие"), block("c", "Композиция", "Композиция и сетки")];
    const config: VisualizationConfig = {
      visualizationVersion: "0.1.0",
      domain: "it",
      professionId: "it.uxui",
      status: "draft",
      note: "Черновая сеть",
      nodes: [
        { competencyId: "f", tier: "foundation", order: 1, prerequisites: [], shortDescription: "Цвет и восприятие" },
        { competencyId: "c", tier: "core", order: 2, prerequisites: ["f"], shortDescription: "Композиция и сетки" },
      ],
    };
    const layout = layoutCompetencies({
      domain: "it",
      professionId: "it.uxui",
      blocks,
      marks: [mark("f", "foundation", 1), mark("c", "core", 2, ["f"])],
    });
    const data = buildVisualizationPageData({
      layout,
      blocks,
      config,
      generatedOn: "2026-10-21",
    });
    assert.equal(data.nodes.length, 2);
    assert.equal(data.edges.length, 1);
    assert.equal(data.counts.foundation, 1);
    const html = renderCanvasPage(data);
    assert.match(html, /Теория цвета/);
    assert.match(html, /Композиция/);
    assert.match(html, /tier-foundation/);
    assert.match(html, /Черновой слой/);
    assert.match(html, /data-from="f"/);
    assert.match(html, /const DATA =/);
  });

  it("экранирует названия в HTML", () => {
    const html = renderCanvasPage({
      title: "<script>alert(1)</script>",
      subtitle: "S",
      note: "N",
      generatedOn: "2026-10-21",
      nodes: [],
      edges: [],
      stage: { width: 10, height: 10, offsetX: 0, offsetY: 0 },
      counts: { foundation: 0, core: 0, optional: 0 },
    });
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.match(html, /&lt;script&gt;alert/);
  });
});
