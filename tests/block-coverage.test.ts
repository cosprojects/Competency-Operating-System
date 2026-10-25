import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CanonicalMap } from "../src/methodology/v1/competency/canonical/types.ts";
import {
  canonicalIdsByBlock,
  competenciesWithoutBlocks,
  withDerivedCanonicalIds,
} from "../src/methodology/v1/competency/canonical/block-coverage.ts";
import type { CompetencyBlock } from "../src/methodology/v1/competency/types.ts";

function block(id: string, overrides: Partial<CompetencyBlock> = {}): CompetencyBlock {
  return {
    id,
    slug: id,
    title: id,
    aliases: [],
    definition: "D",
    scope: "universal",
    professionIds: ["it.uxui"],
    components: [],
    tags: [],
    sourceRefs: [],
    evidenceState: "supported",
    status: "accepted",
    llmMeta: { promptVersion: "test", model: "test", inputHash: "test", costUsd: 0 },
    issues: [],
    methodologyVersion: "0.1.0",
    ...overrides,
  };
}

const map: CanonicalMap = {
  canonicalVersion: "0.1.0",
  domain: "it",
  professionId: "it.uxui",
  updatedOn: "2026-10-22",
  status: "accepted",
  principles: [],
  branches: [
    {
      id: "ux",
      order: 1,
      title: "UX",
      definition: "Опыт",
      sections: [
        {
          id: "research",
          order: 1,
          title: "Исследования",
          definition: "Исследования",
          competencies: [
            { id: "c1", order: 1, title: "Интервью", definition: "D", priorityHint: "core", status: "covered", coveredBy: ["b1", "b2"] },
            { id: "c2", order: 2, title: "Метрики", definition: "D", priorityHint: "core", status: "covered", coveredBy: ["b2"] },
          ],
        },
      ],
    },
  ],
  excludedBlocks: [],
};

describe("canonical → block coverage", () => {
  it("собирает обратное отображение blockId → canonicalIds", () => {
    const derived = canonicalIdsByBlock(map);
    assert.deepEqual(derived.get("b1"), ["c1"]);
    assert.deepEqual(derived.get("b2"), ["c1", "c2"]);
    assert.equal(derived.get("b3"), undefined);
  });

  it("дописывает выведенные canonicalIds, не теряя объявленные", () => {
    const derived = canonicalIdsByBlock(map);
    const known = new Set(["c1", "c2", "product-jtbd"]);
    const enriched = withDerivedCanonicalIds(block("b2", { canonicalIds: ["product-jtbd"] }), derived, known);
    assert.deepEqual(enriched.canonicalIds, ["c1", "c2", "product-jtbd"]);
    const untouched = withDerivedCanonicalIds(block("b3"), derived, known);
    assert.equal(untouched.canonicalIds, undefined);
  });

  it("не добавляет ссылки на компетенции вне известного массива", () => {
    const derived = new Map([["b9", ["missing"]]]);
    const enriched = withDerivedCanonicalIds(block("b9"), derived, new Set(["c1"]));
    assert.equal(enriched.canonicalIds, undefined);
  });

  it("находит компетенции без accepted-блока", () => {
    const blocks = [block("b1", { canonicalIds: ["c1"] }), block("b2", { canonicalIds: ["c2"], status: "needs_review" })];
    assert.deepEqual(competenciesWithoutBlocks(["c1", "c2", "c3"], blocks), ["c2", "c3"]);
  });
});
