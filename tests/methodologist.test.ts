import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { CandidateQueue, ProfessionCatalogFile } from "../src/methodology/v1/candidate-parser/types.ts";
import {
  buildMethodologistPatch,
  type MethodologistGraph,
} from "../src/methodology/v1/methodologist/decide.ts";

const graph: MethodologistGraph = {
  nodes: [
    { id: "node_form_comp", title: "Форма и композиция", shortTitle: "Форма" },
    { id: "node_design_systems", title: "Дизайн-системы", shortTitle: "Системы" },
  ],
  tracks: [
    {
      id: "graphic",
      requiredNodes: [{ nodeId: "node_form_comp", targetLevel: "L3", isCore: true }],
    },
    {
      id: "uxui",
      requiredNodes: [],
    },
  ],
};

const professions = [
  { id: "graphic", status: "open_for_assessment" },
  { id: "uxui", status: "open_for_assessment" },
  { id: "spatial_interior_arch", status: "described_not_open" },
];

function queue(candidates: CandidateQueue["candidates"]): CandidateQueue {
  return {
    queueVersion: "1.0.0",
    retrievedOn: "2026-10-19",
    writesToGraph: false,
    professionIds: ["graphic", "uxui"],
    sources: [],
    candidates,
  };
}

describe("methodologist patch", () => {
  it("maps a known action, skips an existing requirement, and does not invent anchors", () => {
    const patch = buildMethodologistPatch({
      graph,
      professions,
      queue: queue([
        {
          id: "c1",
          professionId: "uxui",
          phrase: "design tokens",
          source: "esco",
          sourceRecordId: "skill:tokens",
          sourceOccupationTitle: "user interface designer",
          relation: "essential",
          kind: "skill",
          fragment: "essential skill «design tokens»",
          retrievedOn: "2026-10-19",
        },
        {
          id: "c2",
          professionId: "graphic",
          phrase: "typography",
          source: "esco",
          sourceRecordId: "skill:type",
          sourceOccupationTitle: "graphic designer",
          relation: "essential",
          kind: "skill",
          fragment: "essential skill «typography»",
          retrievedOn: "2026-10-19",
        },
        {
          id: "c3",
          professionId: "graphic",
          phrase: "digital media",
          source: "esco",
          sourceRecordId: "skill:media",
          sourceOccupationTitle: "graphic designer",
          relation: "essential",
          kind: "knowledge",
          fragment: "essential knowledge «digital media»",
          retrievedOn: "2026-10-19",
        },
        {
          id: "c4",
          professionId: "graphic",
          phrase: "Adobe Photoshop",
          source: "esco",
          sourceRecordId: "skill:ps",
          sourceOccupationTitle: "graphic designer",
          relation: "optional",
          kind: "skill",
          fragment: "optional skill «Adobe Photoshop»",
          retrievedOn: "2026-10-19",
        },
        {
          id: "c5",
          professionId: "spatial_interior_arch",
          phrase: "ergonomics",
          source: "esco",
          sourceRecordId: "skill:ergo",
          sourceOccupationTitle: "interior designer",
          relation: "essential",
          kind: "knowledge",
          fragment: "essential knowledge «ergonomics»",
          retrievedOn: "2026-10-19",
        },
      ]),
    });

    assert.equal(patch.writesToGraph, false);
    assert.equal(patch.decisions[0]?.outcome, "ambiguous");
    assert.equal(patch.decisions[0]?.nodeId, "node_design_systems");
    assert.equal(patch.decisions[0]?.needsReview, true);
    assert.equal(patch.decisions[0]?.targetLevel, undefined);
    assert.equal(patch.decisions[1]?.outcome, "ambiguous");
    assert.equal(patch.decisions[2]?.outcome, "needs_node");
    assert.equal(patch.decisions[2]?.nodeId, undefined);
    assert.equal(patch.decisions[3]?.outcome, "reject_tool");
    assert.equal(patch.decisions[4]?.outcome, "reject_closed");
    assert.equal(patch.counts.ambiguous, 2);
    assert.equal(patch.counts.needs_node, 1);
  });

  it("binds a full source fragment to an existing node without a preset node id", () => {
    const patch = buildMethodologistPatch({
      professions,
      graph: {
        nodes: [
          {
            id: "node_ux_research",
            title: "Исследования пользователей и юзабилити-тесты",
            shortTitle: "Исследования",
            behavioralAnchors: {
              L1: "Проводил отдельные интервью или показы макетов по готовому скрипту",
            },
          },
          {
            id: "node_form_comp",
            title: "Форма, композиция и цветовая гармония",
            shortTitle: "Форма",
            behavioralAnchors: {
              L0: "Знаю базовые правила сетки, контраста и сочетания цветов",
            },
          },
        ],
        tracks: [{ id: "uxui", requiredNodes: [] }],
      },
      queue: queue([
        {
          id: "interview",
          professionId: "uxui",
          phrase: "Проводит интервью с пользователями",
          source: "esco",
          sourceRecordId: "https://example.test/research",
          sourceOccupationTitle: "uxui",
          relation: "essential",
          kind: "statement",
          fragment: "Проводил отдельные интервью, чтобы понять потребности пользователей.",
          sourceUrl: "https://example.test/research",
          retrievedOn: "2026-10-19",
        },
      ]),
    });

    assert.equal(patch.decisions[0]?.outcome, "add_requirement");
    assert.equal(patch.decisions[0]?.nodeId, "node_ux_research");
    assert.equal(patch.decisions[0]?.roleSpecificContext, "Проводит интервью с пользователями");
    assert.equal(patch.decisions[0]?.sourceUrl, "https://example.test/research");
  });

  it("matches a Russian rendering and leaves the English source fragment untouched", () => {
    const candidate = {
      id: "wire",
      professionId: "uxui",
      phrase: "create website wireframe",
      source: "esco" as const,
      sourceRecordId: "http://data.europa.eu/esco/skill/wire",
      sourceOccupationTitle: "user interface designer",
      relation: "essential" as const,
      kind: "skill",
      fragment: "Develop an image that displays the functional elements of a website.",
      matchText: "Строю базовые карты сайта и меню навигации, чтобы показать структуру сервиса.",
      sourceUrl: "http://data.europa.eu/esco/skill/wire",
      retrievedOn: "2026-10-19",
    };
    const graph = {
      nodes: [
        {
          id: "node_info_arch",
          title: "Информационная архитектура и навигация",
          shortTitle: "Инфо-архитектура",
          behavioralAnchors: {
            L1: "Строю базовые карты сайта и меню навигации для типовых сервисов",
          },
        },
      ],
      tracks: [{ id: "uxui", requiredNodes: [] as [] }],
    };
    const withRussian = buildMethodologistPatch({
      professions,
      graph,
      queue: queue([candidate]),
    });
    const englishOnly = buildMethodologistPatch({
      professions,
      graph,
      queue: queue([{ ...candidate, matchText: undefined }]),
    });

    assert.equal(withRussian.decisions[0]?.outcome, "add_requirement");
    assert.equal(withRussian.decisions[0]?.nodeId, "node_info_arch");
    assert.equal(withRussian.decisions[0]?.reason.includes("строю базовые карты"), true);
    assert.equal(englishOnly.decisions[0]?.outcome, "needs_node");
    assert.equal(candidate.fragment.startsWith("Develop"), true);
  });
});

const designGraph = JSON.parse(
  readFileSync(new URL("../src/methodology/v1/design-competency-graph.json", import.meta.url), "utf8"),
) as MethodologistGraph;
const catalog = JSON.parse(
  readFileSync(new URL("../src/methodology/v1/profession-catalog.json", import.meta.url), "utf8"),
) as ProfessionCatalogFile;

function candidate(fields: Pick<CandidateQueue["candidates"][number], "id" | "professionId" | "phrase" | "fragment"> & {
  matchText?: string;
  relation?: "essential" | "optional";
}) {
  return {
    source: "esco" as const,
    sourceRecordId: fields.id,
    sourceOccupationTitle: fields.professionId,
    relation: fields.relation ?? "essential" as const,
    kind: "skill",
    sourceUrl: `https://example.test/${fields.id}`,
    retrievedOn: "2026-10-19",
    ...fields,
  };
}

describe("action match on the design graph", () => {
  it("keeps known actions and does not turn stem collisions into requirements", () => {
    const patch = buildMethodologistPatch({
      professions: catalog.professions,
      graph: designGraph,
      queue: queue([
        candidate({
          id: "interview",
          professionId: "uxui",
          phrase: "Проводит интервью с пользователями",
          fragment: "Проводил отдельные интервью, чтобы понять потребности пользователей.",
        }),
        candidate({
          id: "ia-action",
          professionId: "uxui",
          phrase: "create website wireframe",
          fragment: "Develop an image that displays the functional elements of a website.",
          matchText: "Строю базовые карты сайта и меню навигации, чтобы показать структуру сервиса.",
        }),
        candidate({
          id: "a11y",
          professionId: "uxui",
          phrase: "test system accessibility for users with special needs",
          fragment: "Examine whether a system can be used by people with special needs.",
        }),
        candidate({
          id: "marketing",
          professionId: "brand",
          phrase: "marketing management",
          fragment: "The academic discipline and function in an organisation which focuses on the market research, market development, and the creation of marketing campaigns to raise awareness on the company's services and products.",
          matchText: "Управление маркетингом: академическая дисциплина и функция организации, которая занимается исследованием рынка, развитием рынка и созданием маркетинговых кампаний, чтобы повысить осведомлённость об услугах и продуктах компании.",
          relation: "optional",
        }),
        candidate({
          id: "wire-source",
          professionId: "uxui",
          phrase: "create website wireframe",
          fragment: "Develop an image or set of images that display the functional elements of a website or page, typically used for planning a website's functionality and structure.",
          matchText: "Создаю каркас сайта: разрабатываю изображение или набор изображений, которые показывают функциональные элементы сайта или страницы и обычно используются, чтобы спланировать функциональность и структуру сайта.",
        }),
      ]),
    });

    const byId = new Map(patch.decisions.map((decision) => [decision.candidateId, decision]));
    const interview = byId.get("interview");
    const ia = byId.get("ia-action");
    const a11y = byId.get("a11y");
    const marketing = byId.get("marketing");
    const wire = byId.get("wire-source");

    assert.equal(interview?.outcome, "already_required");
    assert.equal(interview?.nodeId, "node_ux_research");
    assert.equal(interview?.reason.includes("проводил отдельные интервью"), true);

    assert.equal(ia?.outcome, "already_required");
    assert.equal(ia?.nodeId, "node_info_arch");

    assert.equal(a11y?.outcome, "ambiguous");
    assert.equal(a11y?.nodeId, "node_ergonomics_human");
    assert.equal(a11y?.targetLevel, undefined);

    assert.notEqual(marketing?.outcome, "add_requirement");
    assert.notEqual(marketing?.outcome, "already_required");
    assert.notEqual(marketing?.nodeId, "node_prod_metrics");

    assert.notEqual(wire?.outcome, "add_requirement");
    assert.notEqual(wire?.outcome, "already_required");
    assert.notEqual(wire?.nodeId, "node_info_arch");
    assert.equal(patch.counts.add_requirement, 0);
  });
});