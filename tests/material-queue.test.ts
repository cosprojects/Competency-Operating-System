import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompetencyBlock, Material } from "../src/methodology/v1/competency/types.ts";
import { createMaterialAgentDeps } from "../src/methodology/v1/materials-agent/agent.ts";
import { buildMaterialQueue, runMaterialQueue } from "../src/methodology/v1/materials-agent/queue.ts";
import { renderMaterialQueueReview } from "../src/methodology/v1/materials-agent/review.ts";

function block(id: string, title: string, overrides: Partial<CompetencyBlock> = {}): CompetencyBlock {
  return {
    id, slug: id, title, aliases: [], definition: "Определение", scope: "profession", professionIds: ["it.uxui"],
    components: [], tags: [], sourceRefs: [], evidenceState: "needs_review", status: "accepted",
    llmMeta: { promptVersion: "v", model: "m", inputHash: "h", costUsd: 0 }, issues: [], methodologyVersion: "0.1.0",
    ...overrides,
  };
}
function material(id: string, competencyId: string): Material {
  return {
    id, slug: id, kind: "article", title: `Материал ${id}`, provider: "Wikipedia",
    url: `https://example.com/${id}`, canonicalUrl: `https://example.com/${id}`, language: "ru", access: "free",
    description: "Описание", license: "CC BY-SA 4.0",
    sourceRef: { sourceId: "wikipedia", externalId: id, url: `https://example.com/${id}`, retrievedAt: "2026-10-21", license: "CC BY-SA 4.0" },
    retrievedAt: "2026-10-21", links: [], discoveredFor: [competencyId], status: "candidate", issues: [],
  };
}
const catalog = {
  catalogVersion: "0.1.0", domain: "it", updatedOn: "2026-10-21",
  blocks: [block("b1", "Дизайн-мышление"), block("b2", "Типографика")], tags: [], materials: [],
};

describe("material queue", () => {
  it("строит очередь по professionId + competencyId", () => {
    const queue = buildMaterialQueue(catalog as never, "it.uxui");
    assert.equal(queue.length, 2);
    assert.equal(queue[0]?.id, "it.uxui:b1");
  });

  it("строит очередь по компетенциям view, включая переиспользованные блоки", () => {
    const productCatalog = {
      ...catalog,
      blocks: [
        block("own", "Продуктовый блок", { professionIds: ["it.product"], canonicalIds: ["product-jtbd"] }),
        block("reused", "Переиспользованный UX-блок", { canonicalIds: ["ux-user-research", "ux-analytics"] }),
        block("shared", "Общий блок", { canonicalIds: ["ux-personas"] }),
        block("foreign", "Чужой блок", { professionIds: ["it.motion"], canonicalIds: ["motion-timing-easing"] }),
      ],
    };
    const queue = buildMaterialQueue(productCatalog as never, "it.product", {
      competencyIds: ["ux-user-research", "product-jtbd", "ux-analytics", "ux-personas"],
    });
    assert.deepEqual(queue.map((item) => item.competencyId), ["reused", "own", "shared"]);
    assert.equal(queue[0]?.id, "it.product:reused");
    assert.ok(!queue.some((item) => item.competencyId === "foreign"));
    const legacy = buildMaterialQueue(productCatalog as never, "it.product");
    assert.deepEqual(legacy.map((item) => item.competencyId), ["own"]);
  });

  it("делает retry по элементу и агрегирует coverage", async () => {
    const attempts = new Map<string, number>();
    const deps = createMaterialAgentDeps({
      collect: async ({ competencies }) => {
        const competency = competencies[0]!;
        attempts.set(competency.id, (attempts.get(competency.id) ?? 0) + 1);
        if (competency.id === "b1" && (attempts.get("b1") ?? 0) === 1) throw new Error("temporary");
        return {
          materials: [material(`m-${competency.id}`, competency.id)],
          coverage: [{ competencyId: competency.id, title: competency.title, materials: 1, kinds: { article: 1 } }],
          notes: [],
        };
      },
      validate: () => ({ errors: [], coverage: [] }),
    });
    const journal = await runMaterialQueue({
      domain: "it", professionId: "it.uxui", catalog: catalog as never,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
      retrievedOn: "2026-10-21", concurrency: 2, maxAttempts: 2,
    }, deps);
    assert.equal(journal.agentMode, "worker");
    assert.equal(journal.totals.items, 2);
    assert.equal(journal.totals.completed, 2);
    assert.equal(journal.totals.failed, 0);
    assert.equal(journal.totals.discovered, 2);
    assert.ok(journal.items.some((item) => item.item.competencyId === "b1" && item.attempts === 2));
    assert.equal(journal.writesToGraph, false);
  });

  it("показывает покрытие компетенций профессии в review", async () => {
    const blocks = [
      block("reused", "Переиспользованный блок", { canonicalIds: ["ux-user-research"] }),
      block("own", "Свой блок", { canonicalIds: ["product-jtbd"] }),
    ];
    const reviewCatalog = { ...catalog, blocks };
    const deps = createMaterialAgentDeps({
      collect: async ({ competencies }) => {
        const competency = competencies[0]!;
        return {
          materials: competency.id === "reused" ? [material("m1", competency.id)] : [],
          coverage: [{ competencyId: competency.id, title: competency.title, materials: competency.id === "reused" ? 1 : 0, kinds: {} }],
          notes: [],
        };
      },
      validate: () => ({ errors: [], coverage: [] }),
    });
    const journal = await runMaterialQueue({
      domain: "it", professionId: "it.product", catalog: reviewCatalog as never,
      competencyIds: ["ux-user-research", "product-jtbd"],
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
      retrievedOn: "2026-10-25", concurrency: 1, maxAttempts: 1,
    }, deps);
    const review = renderMaterialQueueReview(journal, {
      competencies: [
        { competencyId: "ux-user-research", title: "Пользовательские исследования" },
        { competencyId: "product-jtbd", title: "Jobs-to-be-Done" },
      ],
      blocks,
    });
    assert.match(review, /Покрытие компетенций профессии/);
    assert.match(review, /Пользовательские исследования \| Переиспользованный блок \| 1 \| 0/);
    assert.match(review, /Без материалов: 1 из 2/);
    assert.match(review, /Jobs-to-be-Done/);
  });

  it("помечает элемент failed после исчерпания попыток", async () => {
    const deps = createMaterialAgentDeps({
      collect: async () => { throw new Error("source down"); },
      validate: () => ({ errors: [], coverage: [] }),
    });
    const journal = await runMaterialQueue({
      domain: "it", professionId: "it.uxui", catalog: catalog as never,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
      retrievedOn: "2026-10-21", concurrency: 1, maxAttempts: 2,
    }, deps);
    assert.equal(journal.totals.failed, 2);
    assert.equal(journal.status, "partial");
    assert.ok(journal.notes.some((note) => note.includes("source down")));
  });
});
