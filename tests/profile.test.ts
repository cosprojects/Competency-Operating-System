import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { FetchLike } from "../src/methodology/v1/candidate-parser/types.ts";
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

const graph = { nodes: [], tracks: [] };
const professions = [{ id: "uxui", status: "open_for_assessment" }];

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

  it("каждое правило маппинга указывает на существующую цель", () => {
    const index = indexTaxonomy(realTaxonomy);
    assert.deepEqual(validateMapping(realMapping, index), []);
    assert.ok(realMapping.rules.length >= 50);
    assert.ok(realMapping.sourceOccupations.filter((item) => item.role === "core").length >= 2);
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
