import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompetencyBlock } from "../src/methodology/v1/competency/types.ts";
import type { PriorityFile, StudyPriorityMark } from "../src/methodology/v1/competency/priority/types.ts";
import { validatePriorityFile } from "../src/methodology/v1/competency/priority/validate.ts";
import { buildPriorityTemplate, renderPriorityTemplate } from "../src/methodology/v1/competency/priority/template.ts";

function block(id: string, title: string, profession = "it.uxui", status: CompetencyBlock["status"] = "needs_review"): CompetencyBlock {
  return {
    id,
    slug: id,
    title,
    aliases: [],
    definition: `Определение компетенции ${title}`,
    scope: "profession",
    professionIds: [profession],
    components: [
      { id: `${id}.a`, slug: "a", title: "Компонент А", definition: "Первый компонент", order: 1, tagIds: [] },
      { id: `${id}.b`, slug: "b", title: "Компонент Б", definition: "Второй компонент", order: 2, tagIds: [] },
    ],
    tags: [],
    sourceRefs: [],
    evidenceState: "needs_review",
    status,
    llmMeta: { promptVersion: "v", model: "m", inputHash: "h", costUsd: 0 },
    issues: [],
    methodologyVersion: "0.1.0",
  };
}

function mark(overrides: Partial<StudyPriorityMark> & Pick<StudyPriorityMark, "competencyId" | "tier" | "order">): StudyPriorityMark {
  return {
    prerequisites: [],
    rationale: "Достаточное обоснование приоритета для теста.",
    confidence: "high",
    reviewer: "methodologist",
    reviewedAt: "2026-10-21",
    ...overrides,
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

describe("study priority", () => {
  it("валидирует полный набор foundation/core/optional с зависимостью", () => {
    const result = validatePriorityFile(
      file([
        mark({ competencyId: "c1", tier: "foundation", order: 1 }),
        mark({ competencyId: "c2", tier: "core", order: 2, prerequisites: ["c1"] }),
        mark({ competencyId: "c3", tier: "optional", order: 3 }),
      ]),
      {
        blocks: [block("c1", "Фундамент"), block("c2", "Основная"), block("c3", "Опция")],
        requireComplete: true,
      },
    );
    assert.deepEqual(result.errors, []);
  });

  it("ловит пропуски, дубли order и неизвестный id", () => {
    const result = validatePriorityFile(
      file([
        mark({ competencyId: "c1", tier: "core", order: 1 }),
        mark({ competencyId: "c1", tier: "core", order: 1 }),
        mark({ competencyId: "unknown", tier: "optional", order: 2 }),
      ]),
      { blocks: [block("c1", "Одна"), block("c2", "Две")], requireComplete: true },
    );
    assert.ok(result.errors.some((error) => error.includes("повтор mark")));
    assert.ok(result.errors.some((error) => error.includes("order 1 уже занят")));
    assert.ok(result.errors.some((error) => error.includes("неизвестный competencyId")));
    assert.deepEqual(result.missingCompetencyIds, ["c2"]);
  });

  it("ловит цикл зависимостей и зависимость позже", () => {
    const result = validatePriorityFile(
      file([
        mark({ competencyId: "c1", tier: "core", order: 1, prerequisites: ["c2"] }),
        mark({ competencyId: "c2", tier: "foundation", order: 2, prerequisites: ["c1"] }),
        mark({ competencyId: "c3", tier: "optional", order: 3, prerequisites: ["c1"] }),
      ]),
      { blocks: [block("c1", "A"), block("c2", "B"), block("c3", "C")] },
    );
    assert.ok(result.errors.some((error) => error.includes("цикл")));
    assert.ok(result.errors.some((error) => error.includes("более поздний tier")));
  });

  it("строит шаблон и сохраняет существующие метки", () => {
    const blocks = [block("c1", "Теория цвета"), block("c2", "Адаптивность")];
    const existing = file([mark({ competencyId: "c1", tier: "foundation", order: 1 })]);
    const template = buildPriorityTemplate({
      domain: "it",
      professionId: "it.uxui",
      source: "review",
      blocks,
      existing,
      generatedOn: "2026-10-21",
    });
    assert.equal(template.rows.length, 2);
    assert.equal(template.rows.find((row) => row.competencyId === "c1")?.existingMark?.tier, "foundation");
    assert.equal(template.rows.find((row) => row.competencyId === "c2")?.existingMark, undefined);
    const markdown = renderPriorityTemplate(template);
    assert.match(markdown, /Теория цвета/);
    assert.match(markdown, /Фундаментальная/);
    assert.match(markdown, /competencyId/);
  });

  it("не допускает блока чужой профессии", () => {
    const result = validatePriorityFile(
      file([mark({ competencyId: "c1", tier: "core", order: 1 })]),
      { blocks: [block("c1", "Чужая", "it.frontend")] },
    );
    assert.ok(result.errors.some((error) => error.includes("не относится к профессии")));
  });
});
