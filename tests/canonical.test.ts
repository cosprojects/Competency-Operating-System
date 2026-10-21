import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompetencyBlock } from "../src/methodology/v1/competency/types.ts";
import type { CanonicalMap } from "../src/methodology/v1/competency/canonical/types.ts";
import { validateCanonicalMap } from "../src/methodology/v1/competency/canonical/validate.ts";
import { renderCanonicalCoverage } from "../src/methodology/v1/competency/canonical/report.ts";

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

function map(): CanonicalMap {
  return {
    canonicalVersion: "0.1.0",
    domain: "it",
    professionId: "it.uxui",
    updatedOn: "2026-10-21",
    status: "draft",
    principles: ["UX/UI"],
    branches: [
      {
        id: "ux",
        order: 1,
        title: "UX",
        definition: "Пользовательский опыт",
        sections: [
          {
            id: "research",
            order: 1,
            title: "Исследования",
            definition: "Исследования пользователей",
            competencies: [
              {
                id: "research-methods",
                order: 1,
                title: "Методы исследования",
                definition: "Планирование и синтез исследований.",
                priorityHint: "core",
                status: "covered",
                coveredBy: ["b1"],
              },
              {
                id: "personas",
                order: 2,
                title: "Персоны",
                definition: "Модели целевых пользователей.",
                priorityHint: "core",
                status: "gap",
                coveredBy: [],
              },
            ],
          },
        ],
      },
      {
        id: "ui",
        order: 2,
        title: "UI",
        definition: "Интерфейс",
        sections: [
          {
            id: "visual",
            order: 1,
            title: "Визуальные основы",
            definition: "Цвет и типографика",
            competencies: [
              {
                id: "color",
                order: 1,
                title: "Цвет",
                definition: "Теория цвета и гармония.",
                priorityHint: "foundation",
                status: "partial",
                coveredBy: ["b2"],
              },
            ],
          },
        ],
      },
    ],
    excludedBlocks: [],
  };
}

describe("canonical map", () => {
  it("валидирует два блока, покрытие и пробелы", () => {
    const result = validateCanonicalMap(map(), {
      blocks: [block("b1", "Исследование"), block("b2", "Цвет")],
      requireUxUiBranches: true,
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.coverage.total, 3);
    assert.equal(result.coverage.covered, 1);
    assert.equal(result.coverage.partial, 1);
    assert.equal(result.coverage.gap, 1);
    assert.equal(result.coverage.byBranch.ux?.gap, 1);
    assert.equal(result.coverage.byBranch.ui?.partial, 1);
  });

  it("ловит неклассифицированный блок, gap с блоком и дубли", () => {
    const bad = map();
    bad.branches[0]!.sections[0]!.competencies[1]!.coveredBy = ["b1"];
    bad.branches[1]!.sections[0]!.competencies[0]!.coveredBy = ["unknown"];
    const result = validateCanonicalMap(bad, {
      blocks: [block("b1", "Исследование"), block("b2", "Цвет"), block("b3", "Лишний")],
      requireUxUiBranches: true,
    });
    assert.ok(result.errors.some((error) => error.includes("gap не может иметь coveredBy")));
    assert.ok(result.errors.some((error) => error.includes("неизвестный блок")));
    assert.ok(result.errors.some((error) => error.includes("не классифицированы")));
  });

  it("не требует ровно два блока для других доменов", () => {
    const single = map();
    single.branches = [single.branches[0]!];
    single.branches[0]!.sections[0]!.competencies[1]!.status = "gap";
    const result = validateCanonicalMap(single, {
      blocks: [block("b1", "Исследование"), block("b2", "Цвет")],
      requireUxUiBranches: false,
    });
    assert.equal(result.errors.filter((error) => error.includes("верхнего блока")).length, 0);
  });

  it("рисует coverage-отчёт по секциям", () => {
    const result = validateCanonicalMap(map(), {
      blocks: [block("b1", "Исследование"), block("b2", "Цвет")],
      requireUxUiBranches: true,
    });
    const markdown = renderCanonicalCoverage(map(), result);
    assert.match(markdown, /Компетенций: \*\*3\*\*/);
    assert.match(markdown, /Исследования/);
    assert.match(markdown, /Персоны/);
    assert.match(markdown, /Визуальные основы/);
  });
});
