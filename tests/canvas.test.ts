import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompetencyBlock } from "../src/methodology/v1/competency/types.ts";
import type { PriorityFile, StudyPriorityMark } from "../src/methodology/v1/competency/priority/types.ts";
import { layoutCompetencies } from "../src/methodology/v1/competency/canvas/layout.ts";

function block(id: string, title: string): CompetencyBlock {
  return {
    id,
    slug: id,
    title,
    aliases: [],
    definition: `Определение ${title}`,
    scope: "profession",
    professionIds: ["it.uxui"],
    components: [],
    tags: [],
    sourceRefs: [],
    evidenceState: "needs_review",
    status: "needs_review",
    llmMeta: { promptVersion: "v", model: "m", inputHash: "h", costUsd: 0 },
    issues: [],
    methodologyVersion: "0.1.0",
  };
}

function mark(
  competencyId: string,
  tier: StudyPriorityMark["tier"],
  order: number,
  prerequisites: string[] = [],
): StudyPriorityMark {
  return {
    competencyId,
    tier,
    order,
    prerequisites,
    rationale: "Обоснование для теста раскладки.",
    confidence: "high",
    reviewer: "methodologist",
    reviewedAt: "2026-10-21",
  };
}

function file(marks: StudyPriorityMark[]): PriorityFile {
  return {
    priorityVersion: "1.0.0",
    domain: "it",
    professionId: "it.uxui",
    updatedOn: "2026-10-21",
    status: "draft",
    marks,
  };
}

describe("canvas layout", () => {
  it("ставит единственную foundation-компетенцию в центр", () => {
    const layout = layoutCompetencies({
      domain: "it",
      professionId: "it.uxui",
      blocks: [block("c1", "Теория цвета")],
      marks: file([mark("c1", "foundation", 1)]).marks,
    });
    assert.equal(layout.nodes.length, 1);
    assert.equal(layout.nodes[0]?.x, 600);
    assert.equal(layout.nodes[0]?.y, 400);
    assert.equal(layout.nodes[0]?.ring, 0);
    assert.equal(layout.nodes[0]?.emphasis, "primary");
  });

  it("раскладывает foundation/core/optional по кольцам", () => {
    const blocks = [block("f", "Фундамент"), block("c", "Основная"), block("o", "Опция")];
    const layout = layoutCompetencies({
      domain: "it",
      professionId: "it.uxui",
      blocks,
      marks: file([
        mark("f", "foundation", 1),
        mark("c", "core", 2, ["f"]),
        mark("o", "optional", 3, ["c"]),
      ]).marks,
    });
    const byId = new Map(layout.nodes.map((node) => [node.competencyId, node]));
    assert.equal(byId.get("f")?.ring, 0);
    assert.equal(byId.get("c")?.ring, 1);
    assert.equal(byId.get("o")?.ring, 2);
    assert.equal(byId.get("f")?.emphasis, "primary");
    assert.equal(byId.get("c")?.emphasis, "secondary");
    assert.equal(byId.get("o")?.emphasis, "tertiary");
    assert.equal(layout.edges.length, 2);
    assert.ok((byId.get("o")?.opacity ?? 1) < 1);
  });

  it("детерминирован и не пересекает карточки на большом наборе", () => {
    const blocks: CompetencyBlock[] = [];
    const marks: StudyPriorityMark[] = [];
    for (let i = 0; i < 3; i += 1) {
      blocks.push(block(`f${i}`, `Фундамент ${i}`));
      marks.push(mark(`f${i}`, "foundation", i + 1));
    }
    for (let i = 0; i < 10; i += 1) {
      blocks.push(block(`c${i}`, `Основная ${i}`));
      marks.push(mark(`c${i}`, "core", 10 + i));
    }
    for (let i = 0; i < 14; i += 1) {
      blocks.push(block(`o${i}`, `Опция ${i}`));
      marks.push(mark(`o${i}`, "optional", 30 + i));
    }
    const input = { domain: "it", professionId: "it.uxui", blocks, marks };
    const first = layoutCompetencies(input);
    const second = layoutCompetencies(input);
    assert.deepEqual(first, second);
    assert.equal(first.nodes.length, 27);
    assert.equal(first.nodes.filter((node) => node.ring === 3).length, 2);
    const overlaps = first.diagnostics.filter((item) => item.includes("пересечение"));
    assert.deepEqual(overlaps, []);
    assert.ok(first.bounds.maxX > first.bounds.minX);
  });

  it("падает без меток или разрешает частичный предпросмотр", () => {
    const blocks = [block("c1", "Одна"), block("c2", "Две")];
    const marks = [mark("c1", "foundation", 1)];
    assert.throws(
      () => layoutCompetencies({ domain: "it", professionId: "it.uxui", blocks, marks }),
      /Нет приоритета/,
    );
    const layout = layoutCompetencies({
      domain: "it",
      professionId: "it.uxui",
      blocks,
      marks,
      allowPartial: true,
    });
    assert.ok(layout.diagnostics.some((item) => item.includes("без приоритета")));
  });
});
