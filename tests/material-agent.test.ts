import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompetencyBlock, Material } from "../src/methodology/v1/competency/types.ts";
import { DEFAULT_LLM_POLICY, LlmBudget } from "../src/methodology/v1/competency/llm/policy.ts";
import { runMaterialAgent, createMaterialAgentDeps, describeAgentReadiness } from "../src/methodology/v1/materials-agent/agent.ts";

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
    status: "accepted",
    llmMeta: { promptVersion: "v", model: "m", inputHash: "h", costUsd: 0 },
    issues: [],
    methodologyVersion: "0.1.0",
  };
}

function material(id: string, competencyId: string): Material {
  return {
    id,
    slug: id,
    kind: "article",
    title: `Материал ${id}`,
    provider: "Wikipedia",
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    language: "ru",
    access: "free",
    description: "Описание",
    license: "CC BY-SA 4.0",
    sourceRef: { sourceId: "wikipedia", externalId: id, url: `https://example.com/${id}`, retrievedAt: "2026-10-21", license: "CC BY-SA 4.0" },
    retrievedAt: "2026-10-21",
    links: [],
    discoveredFor: [competencyId],
    status: "candidate",
    issues: [],
  };
}

const catalog = {
  catalogVersion: "0.1.0",
  domain: "it",
  updatedOn: "2026-10-21",
  blocks: [block("b1", "Дизайн-мышление"), block("b2", "Типографика"), block("b3", "Чужая", )],
  tags: [],
  materials: [],
};
catalog.blocks[2]!.professionIds = ["it.frontend"];

const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({}) });

describe("material agent", () => {
  it("ведёт discovery отдельно от классификации и не пишет граф", async () => {
    const deps = createMaterialAgentDeps({
      collect: async ({ competencies }) => ({
        materials: [material("m1", competencies[0]!.id), material("m2", competencies[1]!.id)],
        coverage: competencies.map((competency) => ({
          competencyId: competency.id,
          title: competency.title,
          materials: 1,
          kinds: { article: 1 },
        })),
        notes: [],
      }),
      validate: () => ({
        errors: [],
        coverage: [
          { title: "Дизайн-мышление", materials: 0, kinds: {} },
          { title: "Типографика", materials: 0, kinds: {} },
        ],
      }),
    });
    const journal = await runMaterialAgent({
      domain: "it",
      professionId: "it.uxui",
      catalog: catalog as never,
      fetchImpl,
      retrievedOn: "2026-10-21",
    }, deps);
    assert.equal(journal.writesToGraph, false);
    assert.equal(journal.stages.discovery.competencies, 2);
    assert.equal(journal.stages.discovery.materials, 2);
    assert.equal(journal.materials.length, 2);
    assert.equal(journal.stages.classification, undefined);
    assert.match(describeAgentReadiness(journal), /discovered=2/);
  });

  it("классифицирует материалы и считает linked coverage", async () => {
    const policy = { ...DEFAULT_LLM_POLICY, maxCallsPerRun: 5, maxCostUsd: 1 };
    const budget = new LlmBudget(policy);
    const deps = createMaterialAgentDeps({
      collect: async ({ competencies }) => ({
        materials: [material("m1", competencies[0]!.id)],
        coverage: [{ competencyId: competencies[0]!.id, title: competencies[0]!.title, materials: 1, kinds: { article: 1 } }],
        notes: [],
      }),
      classify: async ({ materials, budget: usedBudget }) => {
        usedBudget.calls += 1;
        return {
          materials: materials.map((item) => ({ ...item, links: [{ competencyId: "b1", relevance: 0.9, reason: "тема", modelProposal: false }] })),
          issues: [],
          runs: [{ costUsd: 0 }],
        };
      },
      validate: () => ({ errors: [], coverage: [{ title: "Дизайн-мышление", materials: 1, kinds: { article: 1 } }] }),
    });
    const journal = await runMaterialAgent({
      domain: "it",
      professionId: "it.uxui",
      catalog: catalog as never,
      fetchImpl,
      retrievedOn: "2026-10-21",
      classify: true,
      transport: {} as never,
      policy,
      budget,
    }, deps);
    assert.equal(journal.stages.classification?.linked, 1);
    assert.equal(journal.stages.classification?.calls, 1);
    assert.equal(journal.status, "completed");
  });
});
