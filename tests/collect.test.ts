import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FetchLike } from "../src/methodology/v1/candidate-parser/types.ts";
import { collectProfessions, collectTags } from "../src/methodology/v1/competency/collect.ts";
import type { ProfessionTarget } from "../src/methodology/v1/competency/types.ts";

const OCCUPATIONS = [
  "O*NET-SOC Code,Title,Description",
  '15-1255.00,"Web and Digital Interface Designers","Design or develop digital interfaces."',
  '13-1161.00,"Market Research Analysts and Marketing Specialists","Research markets and customers."',
  '27-1021.00,"Commercial and Industrial Designers","Design manufactured products."',
].join("\n");

const SOFTWARE = [
  "O*NET-SOC Code,Workplace Example",
  "15-1255.00,Figma",
  "13-1161.00,Microsoft Excel",
].join("\n");

const ESSENTIAL = [
  "O*NET-SOC Code,Element Name,Importance",
  "15-1255.00,Critical Thinking,4.2",
  "13-1161.00,Active Listening,4.1",
].join("\n");

const KNOWLEDGE = [
  "O*NET-SOC Code,Element Name,Importance",
  "15-1255.00,Design,4.0",
  "13-1161.00,Sales and Marketing,3.9",
].join("\n");

const TABLES: Record<string, string> = {
  "occupation_data.csv": OCCUPATIONS,
  "essential_skills.csv": ESSENTIAL,
  "knowledge.csv": KNOWLEDGE,
  "software_skills.csv": SOFTWARE,
};

function fakeFetch(): FetchLike {
  return (async (input: string) => {
    const file = Object.keys(TABLES).find((name) => input.endsWith(name));
    const body = file ? TABLES[file] : undefined;
    if (!body) return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    return { ok: true, status: 200, json: async () => ({}), text: async () => body };
  }) as unknown as FetchLike;
}

const productTarget: ProfessionTarget = {
  id: "product",
  title: "Продуктовый дизайнер",
  titleEn: "Product designer",
  aliases: [],
  onet: { socCodes: ["15-1255.00", "13-1161.00"], titleIncludes: ["Web and Digital Interface Designers"] },
};

describe("сбор профессии из нескольких O*NET-занятий", () => {
  it("принимает все явно объявленные SOC-коды, а не только первое совпадение", async () => {
    const result = await collectProfessions({
      domain: "it",
      targets: [productTarget],
      fetchImpl: fakeFetch(),
      retrievedOn: "2026-10-25",
    });
    const record = result.professions[0]!;
    const onet = record.sources.filter((source) => source.sourceId === "onet").map((source) => source.externalId);
    assert.deepEqual(onet.sort(), ["13-1161.00", "15-1255.00"]);
    assert.equal(record.classification.onetSoc, "15-1255.00,13-1161.00");
    assert.equal(result.searches.find((search) => search.sourceId === "onet")?.found, 2);
  });

  it("собирает теги из каждого O*NET-источника профессии", async () => {
    const professions = [{
      id: "it.product",
      slug: "product",
      title: "Продуктовый дизайнер",
      aliases: [],
      domain: "it" as const,
      classification: { onetSoc: "15-1255.00,13-1161.00" },
      sources: [
        { sourceId: "onet", externalId: "15-1255.00", url: "u1", retrievedAt: "2026-10-25", license: "CC BY 4.0" },
        { sourceId: "onet", externalId: "13-1161.00", url: "u2", retrievedAt: "2026-10-25", license: "CC BY 4.0" },
      ],
      status: "candidate" as const,
    }];
    const result = await collectTags({ professions, fetchImpl: fakeFetch(), retrievedOn: "2026-10-25" });
    const titles = result.tags.map((tag) => tag.title).sort();
    assert.ok(titles.includes("Figma"));
    assert.ok(titles.includes("Microsoft Excel"));
    assert.ok(titles.includes("Critical Thinking"));
    assert.ok(titles.includes("Active Listening"));
    const excel = result.tags.find((tag) => tag.title === "Microsoft Excel");
    assert.deepEqual(excel?.sourceRefs.map((ref) => ref.externalId), ["13-1161.00:software:Microsoft Excel"]);
  });
});
