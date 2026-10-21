import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { FetchLike, FetchResponse } from "../src/methodology/v1/candidate-parser/types.ts";
import { buildProfile } from "../src/methodology/v1/profile/build.ts";
import { indexMapping, validateMapping } from "../src/methodology/v1/profile/mapping.ts";
import { renderProfileMarkdown } from "../src/methodology/v1/profile/render.ts";
import { indexTaxonomy, validateTaxonomy } from "../src/methodology/v1/profile/taxonomy.ts";
import type { MappingFile, TaxonomyFile } from "../src/methodology/v1/profile/types.ts";

const URI = {
  designer: "http://data.europa.eu/esco/occupation/designer",
  graphic: "http://data.europa.eu/esco/occupation/graphic",
  typography: "http://data.europa.eu/esco/skill/typo",
  graphics: "http://data.europa.eu/esco/skill/graphics",
  wireframe: "http://data.europa.eu/esco/skill/wireframe",
  figma: "http://data.europa.eu/esco/skill/figma",
  abap: "http://data.europa.eu/esco/skill/abap",
  cobol: "http://data.europa.eu/esco/skill/cobol",
  business: "http://data.europa.eu/esco/skill/business",
  colorTheory: "http://data.europa.eu/esco/skill/design-principles",
};

const taxonomy: TaxonomyFile = {
  taxonomyVersion: "1.0.0",
  professionId: "uxui",
  title: "UI/UX",
  branches: [
    {
      id: "ui",
      title: "UI Design",
      groups: [
        {
          id: "ui.visual",
          title: "Visual Design",
          kind: "knowledge",
          leaves: [
            { id: "ui.visual.typography", title: "Typography", kind: "knowledge" },
            { id: "ui.visual.color", title: "Color", kind: "knowledge" },
          ],
        },
        {
          id: "ui.tools",
          title: "Design Tools",
          kind: "tool",
          leaves: [{ id: "ui.tools.figma", title: "Figma", kind: "tool" }],
        },
      ],
    },
    {
      id: "ux",
      title: "UX Design",
      groups: [
        {
          id: "ux.process",
          title: "UX Process",
          kind: "skill",
          leaves: [{ id: "ux.process.wireframes", title: "Wireframes", kind: "skill" }],
        },
      ],
    },
  ],
};

const mapping: MappingFile = {
  mappingVersion: "1.0.0",
  professionId: "uxui",
  taxonomyVersion: "1.0.0",
  sourceOccupations: [
    { id: "designer", title: "user interface designer", uri: URI.designer, role: "core" },
    { id: "graphic", title: "graphic designer", uri: URI.graphic, role: "supporting" },
  ],
  rules: [
    { escoTitle: "typography skill", targetId: "ui.visual.typography", basis: "типографика" },
    { escoTitle: "design graphics", targetId: "ui.visual", basis: "визуальный слой" },
    { escoTitle: "create website wireframe", targetId: "ux.process.wireframes", basis: "вайрфрейм" },
    { escoTitle: "Figma", targetId: "ui.tools.figma", kind: "tool", basis: "инструмент" },
    { escoTitle: "missing skill", targetId: "ui.visual.color", basis: "правило без источника" },
  ],
  outOfScope: [
    { regex: "^(ABAP|COBOL)$", reason: "programming_language" },
    { title: "build business relationships", reason: "business_admin" },
  ],
};

const skillDescriptions: Record<string, { title: string; description: string }> = {
  [URI.typography]: { title: "typography skill", description: "Arrange type to make text readable and expressive." },
  [URI.graphics]: { title: "design graphics", description: "Create graphics that communicate an idea." },
  [URI.wireframe]: { title: "create website wireframe", description: "Develop a low fidelity image of a page." },
  [URI.figma]: { title: "Figma", description: "Design interfaces in a collaborative tool." },
  [URI.abap]: { title: "ABAP", description: "Program in ABAP." },
  [URI.cobol]: { title: "COBOL", description: "Program in COBOL." },
  [URI.business]: { title: "build business relationships", description: "Maintain relationships with partners." },
  [URI.colorTheory]: {
    title: "design principles",
    description: "The elements used in design such as unity, scale, proportion, balance, colour, light and shade.",
  },
};

function createFetch(): FetchLike {
  const occupationBody = {
    title: "user interface designer",
    _links: {
      hasEssentialSkill: [
        { uri: URI.typography, title: "typography skill", skillType: "http://data.europa.eu/esco/skill-type/knowledge" },
        { uri: URI.graphics, title: "design graphics", skillType: "http://data.europa.eu/esco/skill-type/skill" },
        { uri: URI.wireframe, title: "create website wireframe", skillType: "http://data.europa.eu/esco/skill-type/skill" },
        { uri: URI.abap, title: "ABAP", skillType: "http://data.europa.eu/esco/skill-type/knowledge" },
      ],
      hasOptionalSkill: [
        { uri: URI.figma, title: "Figma", skillType: "http://data.europa.eu/esco/skill-type/knowledge" },
        { uri: URI.business, title: "build business relationships", skillType: "http://data.europa.eu/esco/skill-type/skill" },
      ],
    },
  };
  const graphicBody = {
    title: "graphic designer",
    _links: {
      hasEssentialSkill: [
        { uri: URI.graphics, title: "design graphics", skillType: "http://data.europa.eu/esco/skill-type/skill" },
      ],
      hasOptionalSkill: [{ uri: URI.cobol, title: "COBOL", skillType: "http://data.europa.eu/esco/skill-type/knowledge" }],
    },
  };

  return async (input) => {
    const url = new URL(input);
    const uri = url.searchParams.get("uri") ?? "";
    if (uri === URI.designer) {
      return { ok: true, status: 200, json: async () => occupationBody };
    }
    if (uri === URI.graphic) {
      return { ok: true, status: 200, json: async () => graphicBody };
    }
    const skill = skillDescriptions[uri];
    if (skill) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          title: skill.title,
          description: { en: { literal: skill.description } },
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

function textResponse(text: string): FetchResponse {
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => text,
  } as unknown as FetchResponse;
}

/** Базовый ESCO-мок плюс текстовые ответы для O*NET/guidance по точному URL. */
function createSourceFetch(extra: Record<string, string>): FetchLike {
  const base = createFetch();
  return async (input, init) => {
    const text = extra[input];
    if (text !== undefined) return textResponse(text);
    return base(input, init);
  };
}

const graph = { nodes: [], tracks: [] };
const professions = [{ id: "uxui", status: "open_for_assessment" }];

const universalTaxonomy: TaxonomyFile = {
  ...taxonomy,
  branches: taxonomy.branches.map((branch) => ({
    ...branch,
    groups: branch.groups.map((group) => ({
      ...group,
      leaves: group.leaves.map((leaf) =>
        leaf.id === "ui.visual.color" ? { ...leaf, scope: "universal" as const } : leaf,
      ),
    })),
  })),
};

const universalMapping: MappingFile = {
  ...mapping,
  universalSkills: [
    {
      escoUri: URI.colorTheory,
      escoTitle: "design principles",
      targetId: "ui.visual.color",
      kind: "knowledge",
      basis: "Описание ESCO прямо называет colour, light и shade — универсальная база.",
    },
  ],
};

async function buildFixture() {
  return buildProfile({
    professionId: "uxui",
    taxonomy,
    mapping,
    graph,
    professions,
    fetchImpl: createFetch(),
    generatedOn: "2026-10-21",
  });
}

async function buildUniversalFixture() {
  return buildProfile({
    professionId: "uxui",
    taxonomy: universalTaxonomy,
    mapping: universalMapping,
    graph,
    professions,
    fetchImpl: createFetch(),
    generatedOn: "2026-10-21",
  });
}

describe("профиль компетенций профессии", () => {
  it("собирает дерево, не пишет граф и сохраняет цитаты источника", async () => {
    const journal = await buildFixture();
    assert.equal(journal.writesToGraph, false);
    assert.equal(journal.stats.uniqueSkills, 7);
    assert.equal(journal.stats.mapped, 4);
    assert.equal(journal.stats.outOfScope, 3);
    assert.equal(journal.stats.unmapped, 0);
    const typography = journal.entries.find((entry) => entry.title === "typography skill");
    assert.equal(typography?.description, "Arrange type to make text readable and expressive.");
    assert.equal(typography?.kind, "knowledge");
    assert.equal(typography?.leafId, "ui.visual.typography");
  });

  it("дедуплицирует навык, встретившийся в двух занятиях, и копит свидетельства", async () => {
    const journal = await buildFixture();
    const graphics = journal.entries.filter((entry) => entry.title === "design graphics");
    assert.equal(graphics.length, 1);
    assert.equal(graphics[0]?.occupations.length, 2);
    assert.equal(graphics[0]?.targetId, "ui.visual");
    assert.equal(graphics[0]?.leafId, undefined);
  });

  it("различает подтверждённый лист и пробел", async () => {
    const journal = await buildFixture();
    const typography = journal.branches
      .flatMap((branch) => branch.groups)
      .flatMap((group) => group.leaves)
      .find((leaf) => leaf.id === "ui.visual.typography");
    const color = journal.branches
      .flatMap((branch) => branch.groups)
      .flatMap((group) => group.leaves)
      .find((leaf) => leaf.id === "ui.visual.color");
    assert.equal(typography?.status, "supported");
    assert.equal(color?.status, "no_evidence");
    assert.deepEqual(journal.gaps.map((gap) => gap.leafId), ["ui.visual.color"]);
    assert.equal(journal.stats.leavesSupported, 3);
    assert.equal(journal.stats.leavesTotal, 4);
  });

  it("объясняет отброшенные навыки и находит правило без источника", async () => {
    const journal = await buildFixture();
    assert.deepEqual(
      journal.outOfScope.map((item) => `${item.title}:${item.reason}`).sort(),
      ["ABAP:programming_language", "COBOL:programming_language", "build business relationships:business_admin"],
    );
    assert.deepEqual(journal.mappingMissing, [
      { escoTitle: "missing skill", targetId: "ui.visual.color" },
    ]);
  });

  it("помечает инструмент инструментом, а не компетенцией", async () => {
    const journal = await buildFixture();
    const figma = journal.entries.find((entry) => entry.title === "Figma");
    assert.equal(figma?.kind, "tool");
    assert.equal(figma?.targetId, "ui.tools.figma");
  });

  it("считает диагностику соответствия графу COS, не меняя граф", async () => {
    const journal = await buildFixture();
    assert.equal(journal.graphFit.counts.needs_node, 3);
    assert.equal(journal.graphFit.counts.reject_tool, 1);
    assert.equal(journal.graphFit.counts.add_requirement, 0);
    for (const entry of journal.entries) {
      const expected = entry.kind === "tool" ? "reject_tool" : "needs_node";
      assert.equal(entry.nodeMatch?.outcome, expected);
      assert.equal(entry.nodeMatch?.nodeId, undefined);
    }
  });

  it("отклоняет маппинг с целью вне таксономии", async () => {
    const broken: MappingFile = {
      ...mapping,
      rules: [{ escoTitle: "typography skill", targetId: "ui.visual.unknown", basis: "нет цели" }],
    };
    await assert.rejects(
      buildProfile({
        professionId: "uxui",
        taxonomy,
        mapping: broken,
        graph,
        professions,
        fetchImpl: createFetch(),
        generatedOn: "2026-10-21",
      }),
      /Маппинг некорректен/,
    );
  });

  it("заполняет универсальный лист доменной записью ESCO", async () => {
    const journal = await buildUniversalFixture();
    const colorLeaf = journal.branches
      .flatMap((branch) => branch.groups)
      .flatMap((group) => group.leaves)
      .find((leaf) => leaf.id === "ui.visual.color");
    assert.equal(colorLeaf?.status, "supported");
    assert.equal(colorLeaf?.scope, "universal");
    const entry = journal.entries.find((item) => item.title === "design principles");
    assert.equal(entry?.evidence, "universal");
    assert.equal(entry?.scope, "universal");
    assert.equal(entry?.kind, "knowledge");
    assert.equal(journal.stats.universalSkills, 1);
    assert.equal(journal.stats.universalLeavesSupported, 1);
    assert.equal(journal.stats.universalLeavesTotal, 1);
    assert.equal(journal.stats.professionLeavesSupported, 3);
    assert.deepEqual(journal.gaps.map((gap) => gap.leafId), []);
  });

  it("отклоняет универсальную запись, если её цель не универсальная", async () => {
    const broken: MappingFile = {
      ...universalMapping,
      universalSkills: [
        {
          escoUri: URI.colorTheory,
          targetId: "ui.visual.typography",
          basis: "цель не универсальная",
        },
      ],
    };
    await assert.rejects(
      buildProfile({
        professionId: "uxui",
        taxonomy: universalTaxonomy,
        mapping: broken,
        graph,
        professions,
        fetchImpl: createFetch(),
        generatedOn: "2026-10-21",
      }),
      /должна быть листом универсальной базы/,
    );
  });

  it("одна запись ESCO может подтверждать несколько листьев", async () => {
    const multiMapping: MappingFile = {
      ...mapping,
      rules: mapping.rules.map((rule) =>
        rule.escoTitle === "typography skill"
          ? { ...rule, additionalTargetIds: ["ui.visual.color"] }
          : rule,
      ),
    };
    const journal = await buildProfile({
      professionId: "uxui",
      taxonomy,
      mapping: multiMapping,
      graph,
      professions,
      fetchImpl: createFetch(),
      generatedOn: "2026-10-21",
    });
    const leaves = journal.branches.flatMap((branch) => branch.groups).flatMap((group) => group.leaves);
    const typography = leaves.find((leaf) => leaf.id === "ui.visual.typography");
    const color = leaves.find((leaf) => leaf.id === "ui.visual.color");
    assert.equal(typography?.status, "supported");
    assert.equal(color?.status, "supported");
    assert.deepEqual(journal.gaps, []);
    const entry = journal.entries.find((item) => item.title === "typography skill");
    assert.deepEqual(entry?.targetIds, ["ui.visual.typography", "ui.visual.color"]);
    assert.equal(entry?.targetId, "ui.visual.typography");
  });

  it("берёт инструмент из O*NET Software Skills и помечает его инструментом", async () => {
    const csv = [
      "O*NET-SOC Code,Title,Workplace Example,Element ID,Element Name,Hot Technology,In Demand",
      '15-1255.00,Web and Digital Interface Designers,Figma,2.E.5.b,Design software,Y,Y',
    ].join("\n");
    const onetMapping: MappingFile = {
      ...mapping,
      onet: {
        databaseVersion: "31.0",
        csvUrl: "https://example.test/software.csv",
        license: "CC BY 4.0",
        occupations: [
          { socCode: "15-1255.00", title: "Web and Digital Interface Designers", role: "core" },
        ],
        tools: [
          { workplaceExample: "Figma", targetId: "ui.tools.figma", kind: "tool", basis: "O*NET" },
        ],
      },
    };
    const journal = await buildProfile({
      professionId: "uxui",
      taxonomy,
      mapping: onetMapping,
      graph,
      professions,
      fetchImpl: createSourceFetch({ "https://example.test/software.csv": csv }),
      generatedOn: "2026-10-21",
    });
    const figma = journal.entries.find((entry) => entry.evidence === "onet");
    assert.equal(figma?.title, "Figma");
    assert.equal(figma?.kind, "tool");
    assert.match(figma?.description ?? "", /Hot Technology/);
    assert.equal(journal.stats.onetSkills, 1);
    const figmaLeaf = journal.branches
      .flatMap((branch) => branch.groups)
      .flatMap((group) => group.leaves)
      .find((leaf) => leaf.id === "ui.tools.figma");
    assert.equal(figmaLeaf?.status, "supported");
    assert.equal(journal.externalSources[0]?.license, "CC BY 4.0");
  });

  it("подтверждает лист цитатой из публичного руководства", async () => {
    const guidanceMapping: MappingFile = {
      ...mapping,
      guidanceSources: [
        {
          id: "manual",
          title: "Manual",
          url: "https://example.test/manual",
          license: "OGL v3.0",
        },
      ],
      guidanceSkills: [
        {
          sourceId: "manual",
          targetId: "ui.visual.color",
          quote: "descriptions of different types of users (for example, personas)",
          basis: "руководство прямо называет персоны",
        },
      ],
    };
    const html =
      "<html><body><p>descriptions of different types of users (for example, personas)</p></body></html>";
    const journal = await buildProfile({
      professionId: "uxui",
      taxonomy,
      mapping: guidanceMapping,
      graph,
      professions,
      fetchImpl: createSourceFetch({ "https://example.test/manual": html }),
      generatedOn: "2026-10-21",
    });
    const entry = journal.entries.find((item) => item.evidence === "guidance");
    assert.equal(entry?.targetId, "ui.visual.color");
    assert.equal(entry?.needsReview, true);
    assert.equal(journal.stats.guidanceSkills, 1);
    assert.deepEqual(journal.guidanceMissing, []);
  });

  it("не подтверждает guidance-лист, если цитаты нет на странице", async () => {
    const guidanceMapping: MappingFile = {
      ...mapping,
      guidanceSources: [
        { id: "manual", title: "Manual", url: "https://example.test/manual", license: "OGL v3.0" },
      ],
      guidanceSkills: [
        { sourceId: "manual", targetId: "ui.visual.color", quote: "нет такой цитаты", basis: "x" },
      ],
    };
    const journal = await buildProfile({
      professionId: "uxui",
      taxonomy,
      mapping: guidanceMapping,
      graph,
      professions,
      fetchImpl: createSourceFetch({ "https://example.test/manual": "<p>другой текст</p>" }),
      generatedOn: "2026-10-21",
    });
    assert.equal(journal.stats.guidanceSkills, 0);
    assert.deepEqual(journal.guidanceMissing.map((item) => item.reason), ["цитата не найдена на странице"]);
  });

  it("помечает лист model_only по якорю графа и watchlist без свидетельств", async () => {
    const graphWithNode = {
      nodes: [
        {
          id: "node_form_comp",
          title: "Форма и композиция",
          shortTitle: "Форма",
          behavioralAnchors: { L0: "Знаю базовые правила сетки и сочетания цветов" },
        },
      ],
      tracks: [],
    };
    const modelMapping: MappingFile = {
      ...mapping,
      modelSkills: [
        {
          leafId: "ui.visual.color",
          nodeId: "node_form_comp",
          quote: "Знаю базовые правила сетки",
          basis: "якорь графа",
        },
      ],
    };
    const journal = await buildProfile({
      professionId: "uxui",
      taxonomy,
      mapping: modelMapping,
      graph: graphWithNode,
      professions,
      fetchImpl: createFetch(),
      generatedOn: "2026-10-21",
    });
    const color = journal.branches
      .flatMap((branch) => branch.groups)
      .flatMap((group) => group.leaves)
      .find((leaf) => leaf.id === "ui.visual.color");
    assert.equal(color?.status, "model_only");
    assert.equal(journal.stats.modelSkills, 1);
    assert.equal(journal.entries.find((entry) => entry.evidence === "model")?.sourceUrl, "src/methodology/v1/design-competency-graph.json#node_form_comp");

    const watchMapping: MappingFile = {
      ...mapping,
      watchlist: [{ leafId: "ui.visual.color", reason: "нет официальной записи" }],
    };
    const watchJournal = await buildProfile({
      professionId: "uxui",
      taxonomy,
      mapping: watchMapping,
      graph,
      professions,
      fetchImpl: createFetch(),
      generatedOn: "2026-10-21",
    });
    const watchColor = watchJournal.branches
      .flatMap((branch) => branch.groups)
      .flatMap((group) => group.leaves)
      .find((leaf) => leaf.id === "ui.visual.color");
    assert.equal(watchColor?.status, "watchlist");
    assert.equal(watchColor?.note, "нет официальной записи");
    assert.deepEqual(watchJournal.gaps, []);
  });

  it("рендерит дерево, пробелы и ограничения без записи в граф", async () => {
    const journal = await buildFixture();
    const markdown = renderProfileMarkdown(journal);
    assert.match(markdown, /UI Design/);
    assert.match(markdown, /Typography/);
    assert.match(markdown, /пробел/);
    assert.match(markdown, /writesToGraph: false/);
    assert.match(markdown, /Не сопоставлено/);
  });
});

describe("эталонная таксономия и маппинг UX/UI", () => {
  const root = process.cwd();
  const realTaxonomy = JSON.parse(
    readFileSync(`${root}/src/methodology/v1/profile/taxonomy/uxui.json`, "utf8"),
  ) as TaxonomyFile;
  const realMapping = JSON.parse(
    readFileSync(`${root}/src/methodology/v1/profile/mapping/uxui.json`, "utf8"),
  ) as MappingFile;

  it("таксономия корректна и содержит 18 листьев двух веток", () => {
    assert.deepEqual(validateTaxonomy(realTaxonomy), []);
    const index = indexTaxonomy(realTaxonomy);
    assert.equal(index.branches.size, 2);
    assert.equal(index.groups.size, 6);
    assert.equal(index.leaves.size, 18);
  });

  it("универсальная база задана листьями scope=universal и доменными занятиями", () => {
    const index = indexTaxonomy(realTaxonomy);
    const universal = [...index.leaves.values()].filter((leaf) => leaf.scope === "universal");
    assert.deepEqual(
      universal.map((leaf) => leaf.id).sort(),
      ["ui.visual.color", "ui.visual.layout", "ui.visual.typography"],
    );
    assert.ok((realMapping.universalSkills ?? []).length >= 4);
    assert.equal((realMapping.universalOccupations ?? []).length, 2);
    for (const occupation of realMapping.universalOccupations ?? []) {
      assert.equal(occupation.role, "universal");
    }
  });

  it("каждое правило маппинга указывает на существующую цель", () => {
    const index = indexTaxonomy(realTaxonomy);
    assert.deepEqual(validateMapping(realMapping, index), []);
    assert.ok(realMapping.rules.length >= 50);
    assert.ok(realMapping.sourceOccupations.filter((item) => item.role === "core").length >= 2);
  });

  it("дополнительные источники и статусы заданы и валидны", () => {
    const index = indexTaxonomy(realTaxonomy);
    assert.deepEqual(validateMapping(realMapping, index), []);
    assert.equal(realMapping.onet?.tools.length, 4);
    assert.equal((realMapping.modelSkills ?? []).length, 2);
    assert.equal((realMapping.guidanceSkills ?? []).length, 1);
    assert.equal((realMapping.watchlist ?? []).length, 2);
    const graphFile = JSON.parse(
      readFileSync(`${root}/src/methodology/v1/design-competency-graph.json`, "utf8"),
    ) as { nodes: Array<{ id: string; title: string; shortTitle: string; description?: string; behavioralAnchors?: Record<string, string> }> };
    for (const rule of realMapping.modelSkills ?? []) {
      const node = graphFile.nodes.find((item) => item.id === rule.nodeId);
      assert.ok(node, `узла ${rule.nodeId} нет`);
      const haystack = [
        node.title,
        node.shortTitle,
        node.description ?? "",
        ...Object.values(node.behavioralAnchors ?? {}),
      ].join(" ");
      assert.ok(
        haystack.toLowerCase().includes(rule.quote.toLowerCase()),
        `цитаты нет в узле ${rule.nodeId}`,
      );
    }
  });

  it("регулярки отброса компилируются и применяются к известным названиям", () => {
    const index = indexMapping(realMapping);
    assert.equal(index.outOfScope.length, realMapping.outOfScope.length);
    const programming = realMapping.outOfScope.find((rule) => rule.reason === "programming_language");
    assert.ok(programming?.regex);
    assert.match("ABAP", new RegExp(programming.regex));
    assert.match("Python (computer programming)", new RegExp(programming.regex));
  });
});
