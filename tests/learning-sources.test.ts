import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import type { LearningSourceRegistry } from "../src/methodology/v1/learning-sources/types.ts";
import { validateLearningSources } from "../src/methodology/v1/learning-sources/validate.ts";
import { LEARNING_SEARCH_QUERIES } from "../src/methodology/v1/learning-sources/search.ts";
import { buildLearningSourceMap } from "../src/methodology/v1/learning-sources/map.ts";
import type { CompetenciesFile, ProfessionCompetencyFile } from "../src/methodology/v1/competency/model/types.ts";

const file = new URL("../src/methodology/v1/learning-sources/registry.json", import.meta.url);

describe("learning source library", () => {
  it("содержит валидный реестр источников", async () => {
    const registry = JSON.parse(await readFile(file, "utf8")) as LearningSourceRegistry;
    assert.equal(validateLearningSources(registry).length, 0);
    assert.ok(registry.sources.some((source) => source.id === "motiondesign-school-courses" && source.authority === "primary"));
    assert.ok(registry.sources.some((source) => source.id === "classcentral-uxui-ipl" && source.status === "blocked"));
    assert.ok(registry.sources.some((source) => source.status === "duplicate" && source.duplicateOf));
  });

  it("имеет поисковые шаблоны для четырёх профессий", () => {
    assert.equal(Object.keys(LEARNING_SEARCH_QUERIES).length, 4);
    assert.ok(LEARNING_SEARCH_QUERIES.motion?.includes("motion design free courses"));
  });
});

function competency(id: string, learningSourceIds: string[]) {
  return {
    id,
    branchId: "b",
    branchTitle: "B",
    sectionId: "s",
    sectionTitle: "S",
    title: id,
    definition: "D",
    priorityHint: "core" as const,
    learningSourceIds,
  };
}

function source(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: id,
    url: `https://example.com/${id}`,
    kind: "school" as const,
    professionIds: ["it.motion"],
    languages: ["en"],
    access: "free" as const,
    authority: "primary" as const,
    status: "active" as const,
    topics: ["t"],
    discoveredBy: "manual" as const,
    lastChecked: "2026-10-26",
    ...overrides,
  };
}

const professionFile = (competencyIds: string[]): ProfessionCompetencyFile => ({
  professionId: "it.motion",
  sphereId: "it",
  competencies: competencyIds.map((competencyId, index) => ({
    competencyId,
    tier: "core" as const,
    order: index + 1,
    prerequisites: [],
  })),
});

describe("learning source discoveryOnly", () => {
  it("запрещает primary-источник как discoveryOnly", () => {
    const registry: LearningSourceRegistry = {
      registryVersion: "1.0.0",
      updatedAt: "2026-10-26",
      sources: [
        source("a", { discoveryOnly: true, authority: "secondary" }),
        source("b", { discoveryOnly: true, authority: "primary" }),
      ],
    };
    const errors = validateLearningSources(registry);
    assert.ok(errors.some((error) => error.includes("discoveryOnly не может быть primary")));
    assert.ok(!errors.some((error) => error.includes('«a»')));
  });
});

describe("learning source → competency map", () => {
  it("discoveryOnly источник не даёт предупреждения и не может быть свидетельством", () => {
    const registry = {
      registryVersion: "1.0.0" as const,
      updatedAt: "2026-10-26",
      sources: [source("review-only", { authority: "aggregator", discoveryOnly: true })],
    };
    const clean = buildLearningSourceMap({
      registry,
      competencies: { modelVersion: "1.0.0", competencies: [competency("c1", [])] } as CompetenciesFile,
      professionCompetencies: [professionFile(["c1"])],
    });
    assert.ok(!clean.warnings.some((warning) => warning.includes("не связан")));
    const bad = buildLearningSourceMap({
      registry,
      competencies: { modelVersion: "1.0.0", competencies: [competency("c1", ["review-only"])] } as CompetenciesFile,
      professionCompetencies: [professionFile(["c1"])],
    });
    assert.ok(bad.errors.some((error) => error.includes("discoveryOnly")));
  });

  it("строит обратную проекцию и считает покрытие по активным первичным источникам", () => {
    const result = buildLearningSourceMap({
      registry: {
        registryVersion: "1.0.0",
        updatedAt: "2026-10-26",
        sources: [source("active"), source("aggregator", { authority: "aggregator" })],
      },
      competencies: {
        modelVersion: "1.0.0",
        competencies: [
          competency("c1", ["active"]),
          competency("c2", ["aggregator"]),
          competency("c3", []),
        ],
      } as CompetenciesFile,
      professionCompetencies: [professionFile(["c1", "c2", "c3"])],
    });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.bySource.get("active"), ["c1"]);
    assert.deepEqual(result.byCompetency.get("c2"), ["aggregator"]);
    assert.equal(result.coverage[0]?.covered, 1);
    assert.equal(result.coverage[0]?.total, 3);
    assert.deepEqual(result.coverage[0]?.withoutSources, ["c2", "c3"]);
    assert.ok(result.warnings.some((warning) => warning.includes("только агрегаторы")));
  });

  it("запрещает blocked/duplicate источники и чужую профессию", () => {
    const result = buildLearningSourceMap({
      registry: {
        registryVersion: "1.0.0",
        updatedAt: "2026-10-26",
        sources: [
          source("blocked", { status: "blocked" }),
          source("other-profession", { professionIds: ["it.uxui"] }),
        ],
      },
      competencies: {
        modelVersion: "1.0.0",
        competencies: [competency("c1", ["blocked", "other-profession"])],
      } as CompetenciesFile,
      professionCompetencies: [professionFile(["c1"])],
    });
    assert.ok(result.errors.some((error) => error.includes("blocked") && error.includes("не может быть доказательством")));
    assert.ok(result.errors.some((error) => error.includes("не объявлен для профессии")));
    assert.equal(result.coverage[0]?.covered, 0);
  });
});
