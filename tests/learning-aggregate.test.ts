import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import type { CompetenciesFile, ProfessionCompetencyFile, ProfessionsFile } from "../src/methodology/v1/competency/model/types.ts";
import type { LearningSourceRegistry } from "../src/methodology/v1/learning-sources/types.ts";
import { buildOpenSourceAggregation } from "../src/methodology/v1/learning-sources/aggregate.ts";

const root = new URL("../src/methodology/v1/", import.meta.url);
async function json<T>(path: string): Promise<T> { return JSON.parse(await readFile(new URL(path, root), "utf8")) as T; }

describe("open source aggregation", () => {
  it("фильтрует blocked/paid/discovery-only и агрегирует open-источники", async () => {
    const registry = await json<LearningSourceRegistry>("learning-sources/registry.json");
    const links = await json<{ links: Array<{ competencyId: string; sourceIds: string[] }> }>("competency/model/learning-source-links.json");
    const competencies = await json<CompetenciesFile>("competency/model/competencies.json");
    const professions = await json<ProfessionsFile>("competency/model/professions.json");
    const professionCompetencies: ProfessionCompetencyFile[] = [];
    for (const profession of professions.professions) {
      const slug = profession.id.split(".").pop()!;
      professionCompetencies.push(await json<ProfessionCompetencyFile>(`competency/model/profession-competencies/${slug}.json`));
    }
    const result = buildOpenSourceAggregation({ registry, links: links.links, competencies, professions, professionCompetencies, generatedAt: "2026-11-03" });
    assert.equal(result.professions.length, 13);
    assert.ok(result.professions.some((item) => item.professionId === "it.game"));
    assert.ok(result.professions.some((item) => item.openSources > 0));
    assert.ok(result.excluded.some((item) => item.reason.includes("blocked")));
    assert.ok(result.excluded.some((item) => item.reason.includes("access=paid")));
    assert.ok(result.professions.every((item) => item.sources.every((source) => source.access === "free" || source.access === "freemium")));
  });
});
