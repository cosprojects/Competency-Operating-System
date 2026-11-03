import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CatalogFile, CompetencyBlock, Material } from "../src/methodology/v1/competency/types.ts";
import type { MaterialReviewResponse } from "../src/methodology/v1/competency/llm/schemas.ts";
import { DEFAULT_LLM_POLICY, LlmBudget } from "../src/methodology/v1/competency/llm/policy.ts";
import { FixtureTransport } from "../src/methodology/v1/competency/llm/transport.ts";
import { acceptMaterials } from "../src/methodology/v1/materials-agent/accept.ts";
import { acceptanceOf } from "../src/methodology/v1/materials-agent/limits.ts";
import { buildMaterialReview, reviewMaterials } from "../src/methodology/v1/materials-agent/verdict.ts";

function policy() {
  return { ...DEFAULT_LLM_POLICY, maxCallsPerRun: 5, maxCostUsd: 0.5 };
}

function block(id = "b1"): CompetencyBlock {
  return {
    id,
    slug: id,
    title: "Принципы анимации",
    aliases: [],
    definition: "Двенадцать принципов анимации и их применение в моушн-дизайне.",
    scope: "profession",
    professionIds: ["it.motion"],
    components: [
      { id: `${id}-c1`, slug: `${id}-c1`, title: "Тайминг", definition: "Скорость и паузы.", order: 1, tagIds: ["t1"] },
      { id: `${id}-c2`, slug: `${id}-c2`, title: "Спайсинг", definition: "Распределение кадров.", order: 2, tagIds: ["t2"] },
    ],
    tags: [
      {
        id: "t1",
        slug: "t1",
        title: "Тайминг",
        aliases: [],
        kind: "skill",
        definition: "Скорость движения.",
        professionIds: ["it.motion"],
        sourceRefs: [],
        evidenceState: "supported",
        competencyLinks: [],
        materialIds: [],
        needsReview: false,
      },
      {
        id: "t2",
        slug: "t2",
        title: "Спайсинг",
        aliases: [],
        kind: "skill",
        definition: "Распределение кадров.",
        professionIds: ["it.motion"],
        sourceRefs: [],
        evidenceState: "supported",
        competencyLinks: [],
        materialIds: [],
        needsReview: false,
      },
    ],
    sourceRefs: [],
    evidenceState: "supported",
    status: "accepted",
    llmMeta: { promptVersion: "v", model: "m", inputHash: "h", costUsd: 0 },
    issues: [],
    methodologyVersion: "0.1.0",
  };
}

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: "material_1",
    slug: "mat_1",
    kind: "article",
    title: "12 принципов анимации",
    provider: "Wikipedia",
    url: "https://example.com/a",
    canonicalUrl: "https://example.com/a",
    language: "ru",
    access: "free",
    description: "Разбор принципов анимации с примерами.",
    snippet: "Тайминг и спайсинг влияют на восприятие движения.",
    license: "CC BY-SA",
    sourceRef: {
      sourceId: "wikipedia",
      externalId: "1",
      url: "https://example.com/a",
      retrievedAt: "2026-11-03",
      license: "CC BY-SA",
    },
    retrievedAt: "2026-11-03",
    links: [{ competencyId: "b1", relevance: 0.8, reason: "Тема совпадает.", modelProposal: false }],
    discoveredFor: ["b1"],
    status: "candidate",
    issues: [],
    ...overrides,
  };
}

function catalog(blocks: CompetencyBlock[]): CatalogFile {
  return {
    catalogVersion: "0.1.0",
    domain: "it",
    updatedOn: "2026-11-03",
    blocks,
    tags: [],
    materials: [],
  };
}

const acceptResponse: MaterialReviewResponse = {
  verdict: "accept",
  confidence: 0.9,
  usefulness: 0.85,
  whyUseful: "Показывает принципы анимации на понятных примерах.",
  reason: "Тема и формат совпадают, материал практичный.",
  flags: [],
};

describe("вердикт Pass E", () => {
  it("принимает уверенный accept с высокой релевантностью", () => {
    assert.equal(acceptanceOf({ verdict: "accept", confidence: 0.9 }, 0.8), "accepted");
  });

  it("пограничный accept уходит в подтверждение", () => {
    assert.equal(acceptanceOf({ verdict: "accept", confidence: 0.9 }, 0.6), "needs_confirmation");
    assert.equal(acceptanceOf({ verdict: "accept", confidence: 0.6 }, 0.9), "needs_confirmation");
  });

  it("confirm и reject не принимаются без бейджа", () => {
    assert.equal(acceptanceOf({ verdict: "confirm", confidence: 0.9 }, 0.9), "needs_confirmation");
    assert.equal(acceptanceOf({ verdict: "reject", confidence: 0.9 }, 0.9), "rejected");
    assert.equal(acceptanceOf({ verdict: "accept", confidence: 0.9 }, 0.3), "rejected");
  });

  it("сохраняет поля вердикта и фильтрует флаги", () => {
    const review = buildMaterialReview({
      response: { ...acceptResponse, flags: ["generic", "no_snippet"] },
      relevance: 0.8,
      reviewedAt: "2026-11-03",
    });
    assert.equal(review.status, "accepted");
    assert.deepEqual(review.flags, ["generic", "no_snippet"]);
    assert.equal(review.reviewer, "methodologist-v1");
  });
});

describe("ревью материалов через LLM-пасс", () => {
  it("проставляет review и статус accepted", async () => {
    const result = await reviewMaterials({
      materials: [material()],
      blocks: [block()],
      transport: new FixtureTransport([JSON.stringify(acceptResponse)]),
      policy: policy(),
      budget: new LlmBudget(policy()),
      retrievedOn: "2026-11-03",
    });
    assert.equal(result.materials.length, 1);
    const review = result.materials[0]!.review;
    assert.equal(review?.verdict, "accept");
    assert.equal(review?.status, "accepted");
    assert.equal(review?.whyUseful, acceptResponse.whyUseful);
  });

  it("не теряет материал, если LLM вернула мусор", async () => {
    const result = await reviewMaterials({
      materials: [material()],
      blocks: [block()],
      transport: new FixtureTransport(["не json"]),
      policy: policy(),
      budget: new LlmBudget(policy()),
      retrievedOn: "2026-11-03",
      allowRepair: false,
    });
    assert.equal(result.materials[0]!.review?.status, "needs_confirmation");
    assert.ok(result.materials[0]!.review?.flags.includes("invalid_response"));
  });
});

describe("приёмка по вердикту", () => {
  const acceptedBlock = block();

  it("accept с высокой уверенностью попадает в каталог", () => {
    const reviewed = material({
      review: {
        ...acceptResponse,
        flags: [],
        reviewedAt: "2026-11-03",
        reviewer: "methodologist-v1",
        status: "accepted",
      },
    });
    const result = acceptMaterials(catalog([acceptedBlock]), [reviewed], { minRelevance: 0.7 });
    assert.equal(result.accepted.length, 1);
    assert.equal(result.accepted[0]!.review?.status, "accepted");
  });

  it("confirm принимается с needs_confirmation и бейджем", () => {
    const reviewed = material({
      links: [{ competencyId: "b1", relevance: 0.6, reason: "По теме.", modelProposal: false }],
      review: {
        verdict: "confirm",
        confidence: 0.6,
        usefulness: 0.5,
        whyUseful: "Возможно, подходит.",
        reason: "Не хватает практики.",
        flags: ["no_practice"],
        reviewedAt: "2026-11-03",
        reviewer: "methodologist-v1",
        status: "needs_confirmation",
      },
    });
    const result = acceptMaterials(catalog([acceptedBlock]), [reviewed], { minRelevance: 0.7 });
    assert.equal(result.accepted.length, 1);
    assert.equal(result.accepted[0]!.review?.status, "needs_confirmation");
  });

  it("reject не публикуется", () => {
    const reviewed = material({
      review: {
        verdict: "reject",
        confidence: 0.9,
        usefulness: 0.1,
        whyUseful: "Не по теме.",
        reason: "Маркетинговая страница.",
        flags: ["marketing"],
        reviewedAt: "2026-11-03",
        reviewer: "methodologist-v1",
        status: "rejected",
      },
    });
    const result = acceptMaterials(catalog([acceptedBlock]), [reviewed], { minRelevance: 0.7 });
    assert.equal(result.accepted.length, 0);
    assert.ok(result.skipped[0]?.reason.includes("reject"));
  });
});
