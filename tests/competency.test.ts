import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { FetchLike, FetchResponse } from "../src/methodology/v1/candidate-parser/types.ts";
import type { CandidateResponse, BlockResponse } from "../src/methodology/v1/competency/llm/schemas.ts";
import { FixtureTransport } from "../src/methodology/v1/competency/llm/transport.ts";
import { DEFAULT_LLM_POLICY, LlmBudget } from "../src/methodology/v1/competency/llm/policy.ts";
import { buildCandidates, validateCandidateResponse } from "../src/methodology/v1/competency/candidates.ts";
import { buildBlocks, validateBlockResponse } from "../src/methodology/v1/competency/blocks.ts";
import { emptyCatalog, validateCatalog } from "../src/methodology/v1/competency/catalog.ts";
import type { TagRecord } from "../src/methodology/v1/competency/types.ts";
import { cleanText, normalizeTitle } from "../src/methodology/v1/competency/sources/common.ts";
import { searchOnetOccupations, collectOnetTags } from "../src/methodology/v1/competency/sources/onet.ts";
import { evaluateCandidateGold } from "../src/methodology/v1/competency/evaluate.ts";
import { validateReconcileResponse } from "../src/methodology/v1/competency/reconcile.ts";
import { materializeSeed } from "../src/methodology/v1/competency/seeds.ts";
import type { ReconcileResponse } from "../src/methodology/v1/competency/llm/schemas.ts";

const root = process.cwd();
const tagsFixture = JSON.parse(
  readFileSync(`${root}/tests/fixtures/competency/tags-color.json`, "utf8"),
) as { domain: string; tags: TagRecord[] };
const candidateResponse = JSON.parse(
  readFileSync(`${root}/tests/fixtures/competency/candidate-response.json`, "utf8"),
) as CandidateResponse[];
const blockResponse = JSON.parse(
  readFileSync(`${root}/tests/fixtures/competency/block-response.json`, "utf8"),
) as BlockResponse[];

function policy() {
  return { ...DEFAULT_LLM_POLICY, maxCallsPerRun: 5, maxCostUsd: 1 };
}

function text(body: string): FetchResponse {
  return { ok: true, status: 200, json: async () => ({}), text: async () => body } as unknown as FetchResponse;
}

function json(body: unknown): FetchResponse {
  return { ok: true, status: 200, json: async () => body };
}

describe("компетенции: теги, кандидаты и блоки", () => {
  it("чистит служебные переводы строк и нормализует названия", () => {
    assert.equal(cleanText("\\n \\n Цвет"), "Цвет");
    assert.equal(normalizeTitle("  Цвет и КОМПОЗИЦИЯ "), "цвет и композиция");
  });

  it("строит кандидата из фикстуры без сети и не пишет граф", async () => {
    const result = await buildCandidates({
      domain: "it",
      tags: tagsFixture.tags,
      transport: new FixtureTransport([JSON.stringify(candidateResponse[0])]),
      policy: policy(),
      budget: new LlmBudget(policy()),
      existingCatalogTitles: [],
    });
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0]?.tagIds.length, 5);
    assert.equal(result.candidates[0]?.status, "candidate");
    assert.deepEqual(result.unassignedTagIds, []);
    assert.equal(result.issues.length, 0);
  });

  it("отклоняет неизвестные теги, инструменты, дубли и слишком маленькие группы", () => {
    const allowed = new Map(tagsFixture.tags.map((tag) => [tag.id, tag]));
    const toolTag: TagRecord = {
      ...tagsFixture.tags[0]!,
      id: "tag_tool",
      title: "Figma",
      kind: "tool",
      definition: "tool",
    };
    allowed.set(toolTag.id, toolTag);
    const response: CandidateResponse = {
      candidates: [
        {
          title: "Группа",
          aliases: [],
          tagIds: [tagsFixture.tags[0]!.id, "tag_unknown", toolTag.id],
          definition: "Достаточно длинное определение для проверки.",
          rationale: "основание",
          scopeHint: "profession",
        },
        {
          title: "Группа",
          aliases: [],
          tagIds: [tagsFixture.tags[1]!.id, tagsFixture.tags[2]!.id],
          definition: "Другой кандидат с тем же названием.",
          rationale: "основание",
          scopeHint: "profession",
        },
        {
          title: "Маленькая",
          aliases: [],
          tagIds: [tagsFixture.tags[3]!.id],
          definition: "Слишком мало тегов для компетенции.",
          rationale: "основание",
          scopeHint: "profession",
        },
      ],
      unassignedTagIds: [],
    };
    const validated = validateCandidateResponse(response, {
      allowedTags: allowed,
      existingTitles: [],
    });
    assert.equal(validated.candidates.length, 1);
    assert.ok(validated.issues.some((issue) => issue.includes("неизвестный tagId")));
    assert.ok(validated.issues.some((issue) => issue.includes("инструмент")));
    assert.ok(validated.issues.some((issue) => issue.includes("дубль кандидата")));
    assert.ok(validated.issues.some((issue) => issue.includes("меньше 2 тегов")));
  });

  it("строит блок с компонентами и новыми тегами, но оставляет его на проверку", async () => {
    const candidates = await buildCandidates({
      domain: "it",
      tags: tagsFixture.tags,
      transport: new FixtureTransport([JSON.stringify(candidateResponse[0])]),
      policy: policy(),
      budget: new LlmBudget(policy()),
      existingCatalogTitles: [],
    });
    const result = await buildBlocks({
      domain: "it",
      candidates: candidates.candidates,
      tags: tagsFixture.tags,
      transport: new FixtureTransport([JSON.stringify(blockResponse[0])]),
      policy: policy(),
      budget: new LlmBudget(policy()),
      existingCatalogTitles: [],
    });
    assert.equal(result.blocks.length, 1);
    const block = result.blocks[0]!;
    assert.equal(block.components.length, 4);
    assert.equal(block.tags.length, 10);
    assert.equal(block.status, "needs_review");
    assert.equal(block.evidenceState, "needs_review");
    assert.ok(block.components.every((component) => component.tagIds.length >= 1));
    assert.ok(result.issues.length === 0);
    assert.ok(result.tags.length >= 1);
    assert.equal(result.blocks[0]?.slug, "teoriya-tsveta-i-koloristika");
  });

  it("валидатор блока ловит выдуманный источник, пустой evidence и плохое покрытие", () => {
    const allowed = new Set(tagsFixture.tags.map((tag) => tag.id));
    const response = structuredClone(blockResponse[0]!);
    response.components[0]!.items[0]!.evidenceTagIds = ["tag_fake"];
    response.components[0]!.items[1]!.modelProposal = false;
    response.components[0]!.items[1]!.evidenceTagIds = [];
    const validated = validateBlockResponse(response, {
      allowedTagIds: allowed,
      existingTitles: [],
    });
    assert.ok(validated.issues.some((issue) => issue.includes("неизвестный evidenceTagId")));
    assert.ok(validated.issues.some((issue) => issue.includes("evidenceTagIds пуст")));
  });

  it("валидирует пустой каталог и ловит не-accepted блок", () => {
    const catalog = emptyCatalog("it", "2026-10-21");
    assert.deepEqual(validateCatalog(catalog), []);
    catalog.blocks.push({
      id: "comp_1",
      slug: "test",
      title: "Тест",
      aliases: [],
      definition: "Достаточно длинное определение компетенции.",
      scope: "profession",
      professionIds: ["it.frontend"],
      components: [
        { id: "test.a", slug: "a", title: "А", definition: "Компонент", order: 1, tagIds: ["tag_1"] },
        { id: "test.b", slug: "b", title: "Б", definition: "Компонент", order: 2, tagIds: ["tag_2"] },
      ],
      tags: [],
      sourceRefs: [],
      evidenceState: "supported",
      status: "needs_review",
      llmMeta: { promptVersion: "v", model: "m", inputHash: "h", costUsd: 0 },
      issues: [],
      methodologyVersion: "0.1.0",
    });
    const errors = validateCatalog(catalog);
    assert.ok(errors.some((error) => error.includes("только accepted")));
  });

  it("считает precision/recall/exact на gold set", async () => {
    const gold = JSON.parse(
      readFileSync(`${root}/tests/fixtures/competency/gold-candidates.json`, "utf8"),
    ) as import("../src/methodology/v1/competency/evaluate.ts").CandidateGoldFile;
    const candidates = await buildCandidates({
      domain: "it",
      tags: tagsFixture.tags,
      transport: new FixtureTransport([JSON.stringify(candidateResponse[0])]),
      policy: policy(),
      budget: new LlmBudget(policy()),
      existingCatalogTitles: [],
    });
    const result = evaluateCandidateGold(gold, candidates.candidates);
    assert.equal(result.metrics.truePositives, 5);
    assert.equal(result.metrics.falsePositives, 0);
    assert.equal(result.metrics.falseNegatives, 0);
    assert.equal(result.metrics.precision, 1);
    assert.equal(result.metrics.recall, 1);
    assert.equal(result.metrics.exactRate, 1);
  });

  it("материализует top-down seed по подсказкам и не притворяется LLM", () => {
    const seed = {
      id: "color-theory",
      title: "Теория цвета и колористика",
      definition: "Системное понимание цвета и композиции в дизайне.",
      professionIds: ["it.uxui"],
      tagHints: ["цвет", "композиц", "визуальн"],
      maxTags: 10,
    };
    const result = materializeSeed(seed, tagsFixture.tags, "2026-10-21");
    assert.ok(result.candidate.tagIds.length >= 2);
    assert.equal(result.missing, false);
    assert.equal(result.candidate.llmMeta.model, "human-seed");
    assert.ok(result.candidate.tagIds.some((id) => tagsFixture.tags.find((tag) => tag.id === id)?.title === "Цвет"));
  });

  it("объединяет кандидатов одного предмета и не теряет теги", () => {
    const tags = tagsFixture.tags;
    const base = {
      definition: "Достаточно длинное определение кандидата для проверки.",
      rationale: "основание",
      scopeHint: "profession" as const,
      status: "candidate" as const,
      llmMeta: { promptVersion: "v", model: "m", inputHash: "h", costUsd: 0 },
      issues: [],
      aliases: [],
      professionIds: ["it.uxui"],
    };
    const candidates = [
      {
        ...base,
        id: "candidate_a",
        slug: "a",
        title: "Визуальные основы",
        tagIds: [tags[0]!.id, tags[1]!.id],
      },
      {
        ...base,
        id: "candidate_b",
        slug: "b",
        title: "Композиция",
        tagIds: [tags[2]!.id, tags[3]!.id],
      },
    ];
    const response: ReconcileResponse = {
      groups: [
        {
          title: "Визуальная композиция",
          memberCandidateIds: ["candidate_a", "candidate_b"],
        },
      ],
      unassignedCandidateIds: [],
    };
    const result = validateReconcileResponse(response, {
      candidates,
      existingCatalogTitles: [],
    });
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0]?.tagIds.length, 4);
    assert.equal(result.unassignedCandidateIds.length, 0);
    assert.deepEqual(result.issues, []);
  });

  it("парсит O*NET-профессии и теги из CSV-фикстур", async () => {
    const occupationCsv = [
      "O*NET-SOC Code,Title,Description",
      '15-1255.00,Web and Digital Interface Designers,"Design interfaces."',
      '15-1252.00,Software Developers,"Build software."',
    ].join("\n");
    const softwareCsv = [
      "O*NET-SOC Code,Title,Workplace Example,Element ID,Element Name,Hot Technology,In Demand",
      "15-1255.00,Web and Digital Interface Designers,Figma,2.E.5.b,Design software,Y,Y",
    ].join("\n");
    const essentialCsv = [
      "O*NET-SOC Code,Title,Element ID,Element Name,Scale ID,Scale Name,Data Value",
      "15-1255.00,Web and Digital Interface Designers,2.A.1.a,Critical Thinking,IM,Importance,4.2",
      "15-1255.00,Web and Digital Interface Designers,2.A.1.a,Critical Thinking,LV,Level,3.5",
    ].join("\n");
    const knowledgeCsv = [
      "O*NET-SOC Code,Title,Element ID,Element Name,Scale ID,Scale Name,Data Value",
      "15-1255.00,Web and Digital Interface Designers,2.C.1.a,Design,IM,Importance,5.0",
    ].join("\n");
    const fetchImpl: FetchLike = async (input) => {
      if (input.includes("occupation_data.csv")) return text(occupationCsv);
      if (input.includes("software_skills.csv")) return text(softwareCsv);
      if (input.includes("essential_skills.csv")) return text(essentialCsv);
      if (input.includes("knowledge.csv")) return text(knowledgeCsv);
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const occupations = await searchOnetOccupations(fetchImpl, undefined, {
      titleIncludes: ["Web and Digital Interface"],
    });
    assert.equal(occupations.length, 1);
    assert.equal(occupations[0]?.socCode, "15-1255.00");
    const tags = await collectOnetTags(fetchImpl, undefined, "15-1255.00", "2026-10-21");
    assert.ok(tags.some((tag) => tag.title === "Figma" && tag.kind === "tool"));
    assert.ok(tags.some((tag) => tag.title === "Critical Thinking" && tag.kind === "skill"));
    assert.ok(tags.some((tag) => tag.title === "Design" && tag.kind === "knowledge"));
  });

  it("парсит ESCO-поиск и описание навыка", async () => {
    const fetchImpl: FetchLike = async (input) => {
      if (input.includes("/search?")) {
        return json({
          _embedded: {
            results: [{ uri: "http://data.europa.eu/esco/occupation/1", title: "Frontend Developer" }],
          },
        });
      }
      if (input.includes("/resource/occupation")) {
        return json({
          title: "Frontend Developer",
          _links: {
            hasEssentialSkill: [
              {
                uri: "http://data.europa.eu/esco/skill/1",
                title: "HTML",
                skillType: "http://data.europa.eu/esco/skill-type/knowledge",
              },
            ],
          },
        });
      }
      if (input.includes("/resource/skill")) {
        return json({ title: "HTML", description: { en: { literal: "Markup language." } } });
      }
      return json({});
    };
    const { searchEscoOccupations, collectEscoTags } = await import(
      "../src/methodology/v1/competency/sources/esco.ts"
    );
    const hits = await searchEscoOccupations(fetchImpl, "frontend developer");
    assert.equal(hits[0]?.title, "Frontend Developer");
    const tags = await collectEscoTags(fetchImpl, undefined, hits[0]!.uri, "2026-10-21");
    assert.equal(tags[0]?.title, "HTML");
    assert.equal(tags[0]?.kind, "knowledge");
    assert.equal(tags[0]?.definition, "Markup language.");
  });
});
