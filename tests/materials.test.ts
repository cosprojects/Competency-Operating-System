import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { FetchLike, FetchResponse } from "../src/methodology/v1/candidate-parser/types.ts";
import type { BlockResponse, CandidateResponse, MaterialResponse } from "../src/methodology/v1/competency/llm/schemas.ts";
import { FixtureTransport } from "../src/methodology/v1/competency/llm/transport.ts";
import { DEFAULT_LLM_POLICY, LlmBudget } from "../src/methodology/v1/competency/llm/policy.ts";
import { buildCandidates } from "../src/methodology/v1/competency/candidates.ts";
import { buildBlocks } from "../src/methodology/v1/competency/blocks.ts";
import type { CompetencyBlock, Material, TagRecord } from "../src/methodology/v1/competency/types.ts";
import {
  collectMaterials,
} from "../src/methodology/v1/competency/materials/collect.ts";
import {
  searchInternetArchive,
  searchStepik,
  searchWikipedia,
} from "../src/methodology/v1/competency/materials/sources.ts";
import { classifyMaterials, validateMaterialResponse } from "../src/methodology/v1/competency/materials/classify.ts";
import { validateMaterials } from "../src/methodology/v1/competency/materials/validate.ts";

const root = process.cwd();
const tags = (
  JSON.parse(readFileSync(`${root}/tests/fixtures/competency/tags-color.json`, "utf8")) as {
    tags: TagRecord[];
  }
).tags;
const candidateResponses = JSON.parse(
  readFileSync(`${root}/tests/fixtures/competency/candidate-response.json`, "utf8"),
) as CandidateResponse[];
const blockResponses = JSON.parse(
  readFileSync(`${root}/tests/fixtures/competency/block-response.json`, "utf8"),
) as BlockResponse[];

function policy() {
  return { ...DEFAULT_LLM_POLICY, maxCallsPerRun: 10, maxCostUsd: 1 };
}
function json(body: unknown): FetchResponse {
  return { ok: true, status: 200, json: async () => body };
}
function text(body: string): FetchResponse {
  return { ok: true, status: 200, json: async () => ({}), text: async () => body } as unknown as FetchResponse;
}

async function builtBlock(): Promise<CompetencyBlock> {
  const candidates = await buildCandidates({
    domain: "it",
    tags,
    transport: new FixtureTransport([JSON.stringify(candidateResponses[0])]),
    policy: policy(),
    budget: new LlmBudget(policy()),
    existingCatalogTitles: [],
  });
  const blocks = await buildBlocks({
    domain: "it",
    candidates: candidates.candidates,
    tags,
    transport: new FixtureTransport([JSON.stringify(blockResponses[0])]),
    policy: policy(),
    budget: new LlmBudget(policy()),
    existingCatalogTitles: [],
  });
  return blocks.blocks[0]!;
}

function materialFor(block: CompetencyBlock): Material {
  return {
    id: "material_1",
    slug: "material-1",
    kind: "article",
    title: "Теория цвета",
    provider: "Wikipedia",
    url: "https://ru.wikipedia.org/wiki/Цвет",
    canonicalUrl: "https://ru.wikipedia.org/wiki/Цвет",
    language: "ru",
    access: "free",
    description: "Статья о цвете",
    snippet: "Цвет — качественная субъективная характеристика электромагнитного излучения.",
    license: "CC BY-SA 4.0",
    sourceRef: {
      sourceId: "wikipedia",
      externalId: "1",
      url: "https://ru.wikipedia.org/wiki/Цвет",
      retrievedAt: "2026-10-21",
      license: "CC BY-SA 4.0",
    },
    retrievedAt: "2026-10-21",
    links: [],
    discoveredFor: [block.id],
    status: "candidate",
    issues: [],
  };
}

describe("материалы компетенций", () => {
  it("парсит статьи Wikipedia", async () => {
    const fetchImpl: FetchLike = async (input) =>
      input.includes("wikipedia")
        ? json({
            query: {
              search: [
                { title: "Цвет", snippet: "Цвет — <span>характеристика</span> излучения.", pageid: 1 },
              ],
            },
          })
        : json({});
    const drafts = await searchWikipedia(fetchImpl, "теория цвета", "2026-10-21");
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0]?.kind, "article");
    assert.equal(drafts[0]?.access, "free");
    assert.match(drafts[0]?.url ?? "", /ru\.wikipedia\.org/);
  });

  it("парсит курсы Stepik и сохраняет платный доступ и цену как наблюдение", async () => {
    const fetchImpl: FetchLike = async () =>
      json({
        courses: [
          {
            id: 42,
            title: "Теория цвета",
            summary: "<p>Курс о цвете</p>",
            is_paid: true,
            price: 1000,
            currency_code: "RUB",
          },
        ],
      });
    const drafts = await searchStepik(fetchImpl, "теория цвета", "2026-10-21");
    assert.equal(drafts[0]?.access, "paid");
    assert.equal(drafts[0]?.price?.amount, 1000);
    assert.equal(drafts[0]?.price?.observedAt, "2026-10-21");
  });

  it("парсит видео Internet Archive как метаданные", async () => {
    const fetchImpl: FetchLike = async () =>
      json({
        response: {
          docs: [
            {
              identifier: "color-lecture",
              title: "Color lecture",
              mediatype: "movies",
              description: "Lecture about color",
              licenseurl: "https://creativecommons.org/licenses/by/4.0/",
            },
          ],
        },
      });
    const drafts = await searchInternetArchive(fetchImpl, "color", "2026-10-21");
    assert.equal(drafts[0]?.kind, "video");
    assert.equal(drafts[0]?.provider, "Internet Archive");
    assert.match(drafts[0]?.license ?? "", /creativecommons/);
  });

  it("собирает материалы по компетенции и отдаёт покрытие", async () => {
    const block = await builtBlock();
    const fetchImpl: FetchLike = async (input) => {
      if (input.includes("wikipedia")) {
        return json({ query: { search: [{ title: "Цвет", snippet: "статья", pageid: 1 }] } });
      }
      return json({ courses: [], response: { docs: [] } });
    };
    const result = await collectMaterials({
      competencies: [block],
      fetchImpl,
      retrievedOn: "2026-10-21",
      sourceIds: ["wikipedia"],
    });
    assert.equal(result.materials.length, 1);
    assert.deepEqual(result.materials[0]?.discoveredFor, [block.id]);
    assert.equal(result.coverage[0]?.materials, 1);
  });

  it("валидирует связи материала: чужая компетенция и отсутствие snippet", async () => {
    const block = await builtBlock();
    const material = { ...materialFor(block), snippet: undefined };
    const response: MaterialResponse = {
      links: [
        {
          competencyId: "comp_other",
          relevance: 0.8,
          reason: "похоже",
          modelProposal: false,
        },
        {
          competencyId: block.id,
          componentId: block.components[0]!.id,
          tagId: block.components[0]!.tagIds[0]!,
          relevance: 0.9,
          reason: "тема совпадает",
          modelProposal: false,
        },
      ],
      rejected: [],
    };
    const validated = validateMaterialResponse(response, { material, blocks: [block] });
    assert.equal(validated.links.length, 1);
    assert.ok(validated.issues.some((issue) => issue.includes("не относится")));
    assert.ok(validated.issues.some((issue) => issue.includes("modelProposal")));
  });

  it("классифицирует материал через LLM и не принимает его автоматически", async () => {
    const block = await builtBlock();
    const material = materialFor(block);
    const response: MaterialResponse = {
      links: [
        {
          competencyId: block.id,
          componentId: block.components[0]!.id,
          tagId: block.components[0]!.tagIds[0]!,
          relevance: 0.92,
          reason: "статья объясняет природу цвета",
          modelProposal: false,
        },
      ],
      rejected: [],
    };
    const result = await classifyMaterials({
      materials: [material],
      blocks: [block],
      transport: new FixtureTransport([JSON.stringify(response)]),
      policy: policy(),
      budget: new LlmBudget(policy()),
    });
    assert.equal(result.materials[0]?.links.length, 1);
    assert.equal(result.materials[0]?.status, "needs_review");
    assert.deepEqual(result.issues, []);
  });

  it("валидирует материалы и считает покрытие free/paid", async () => {
    const block = await builtBlock();
    const material = materialFor(block);
    material.links = [
      {
        competencyId: block.id,
        relevance: 0.9,
        reason: "тема",
        modelProposal: false,
      },
    ];
    const result = validateMaterials([material], [block]);
    assert.deepEqual(result.errors, []);
    assert.equal(result.coverage[0]?.materials, 1);
    assert.equal(result.coverage[0]?.hasFree, true);
    assert.equal(result.coverage[0]?.hasPaid, false);
  });
});
