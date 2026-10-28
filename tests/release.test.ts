import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  CompetenciesFile,
  ProfessionCompetency,
  ProfessionCompetencyFile,
  ProfessionsFile,
} from "../src/methodology/v1/competency/model/types.ts";
import type { CatalogFile, CompetencyBlock, TagRecord } from "../src/methodology/v1/competency/types.ts";
import type { LearningSourceRegistry } from "../src/methodology/v1/learning-sources/types.ts";
import {
  buildPublicContent,
  evaluateRelease,
  type ReleaseInputs,
  type ReleaseManifest,
  type SourceReviewFile,
} from "../scripts/release/lib.ts";

function competency(id: string, title = id) {
  return {
    id,
    branchId: "branch",
    branchTitle: "Branch",
    sectionId: "section",
    sectionTitle: "Section",
    title,
    definition: `Definition ${id}`,
    priorityHint: "core" as const,
    learningSourceIds: ["source-1"],
  };
}

function tag(id: string, kind: "knowledge" | "skill"): TagRecord {
  return {
    id,
    slug: id,
    title: id,
    aliases: [],
    kind,
    definition: "",
    professionIds: ["it.test"],
    sourceRefs: [
      {
        sourceId: "source-1",
        externalId: "ext",
        url: "https://example.com",
        retrievedAt: "2026-10-28",
        license: "unknown",
      },
    ],
    evidenceState: "supported",
    competencyLinks: [],
    materialIds: [],
    needsReview: false,
  };
}

function block(id: string, canonicalId: string, tags: TagRecord[]): CompetencyBlock {
  return {
    id,
    slug: id,
    title: id,
    aliases: [],
    definition: "",
    scope: "profession",
    canonicalIds: [canonicalId],
    professionIds: ["it.test"],
    components: [],
    tags,
    sourceRefs: [],
    evidenceState: "supported",
    status: "accepted",
    llmMeta: { promptVersion: "1", model: "test", inputHash: "hash", costUsd: 0 },
    issues: [],
    methodologyVersion: "1.0.0",
  };
}

function manifest(overrides: Partial<ReleaseManifest> = {}): ReleaseManifest {
  return {
    releaseVersion: "1.0.0",
    releaseId: "test-release",
    title: "Test",
    status: "draft",
    domain: "it",
    professionIds: ["it.test"],
    excludedCompetencyPrefixes: ["ai-"],
    excludedCompetencies: [],
    qualityBar: {
      minKnowledge: 2,
      minSkills: 1,
      minActiveSources: 1,
      requirePrimarySource: false,
      requireSourceSummary: true,
      maxSourceAgeDays: 30,
      requireHumanReview: true,
    },
    sourceReviewFile: "release/test-source-review.json",
    ...overrides,
  };
}

function inputs(options: { review?: SourceReviewFile; sourceIds?: string[]; extraCompetency?: boolean } = {}): ReleaseInputs {
  const competencies = [competency("test-one", "One")];
  if (options.extraCompetency) competencies.push(competency("test-two", "Two"));
  const professionCompetencies: ProfessionCompetency[] = [
    { competencyId: "test-one", tier: "foundation", order: 1, prerequisites: [] },
  ];
  if (options.extraCompetency) {
    professionCompetencies.push({
      competencyId: "test-two",
      tier: "core" as const,
      order: 2,
      prerequisites: ["test-one"],
    });
  }
  const professionFile: ProfessionCompetencyFile = {
    professionId: "it.test",
    sphereId: "it",
    competencies: professionCompetencies,
  };
  const professions: ProfessionsFile = {
    modelVersion: "1.0.0",
    professions: [
      {
        id: "it.test",
        sphereId: "it",
        title: "Test profession",
        canonicalMapFile: "",
        catalogFile: "",
        priorityFile: "",
        sourcesFile: "",
      },
    ],
  };
  const catalog: CatalogFile = {
    catalogVersion: "1.0.0",
    domain: "it",
    updatedOn: "2026-10-28",
    blocks: [
      block("block-one", "test-one", [tag("k1", "knowledge"), tag("k2", "knowledge"), tag("s1", "skill")]),
    ],
    tags: [],
    materials: [],
  };
  const registry: LearningSourceRegistry = {
    registryVersion: "1.0.0",
    updatedAt: "2026-10-28",
    sources: [
      {
        id: "source-1",
        title: "Source one",
        url: "https://example.com/one",
        kind: "course-platform",
        professionIds: ["it.test"],
        languages: ["ru"],
        access: "free",
        authority: "secondary",
        status: "active",
        topics: ["test"],
        discoveredBy: "manual",
        lastChecked: "2026-10-28",
        summary: "Short summary",
      },
    ],
  };
  const review: SourceReviewFile = options.review ?? {
    reviewVersion: "1.0.0",
    releaseId: "test-release",
    updatedAt: "2026-10-28",
    reviewedBy: "founder",
    decisions: [
      {
        professionId: "it.test",
        competencyId: "test-one",
        sourceId: "source-1",
        decision: "accepted",
        reviewedBy: "founder",
        reviewedAt: "2026-10-28",
      },
    ],
  };
  return {
    root: "/tmp",
    manifestPath: "/tmp/release/test.json",
    manifest: manifest(),
    professions,
    competencies: { modelVersion: "1.0.0", competencies } satisfies CompetenciesFile,
    catalog,
    registry,
    sourceReview: review,
    sourceReviewFileFound: true,
    professionFiles: new Map([["it.test", professionFile]]),
    views: new Map([["it.test", null]]),
    linksByCompetency: new Map(),
  };
}

const asOf = new Date("2026-10-28T12:00:00Z");

describe("release evaluation", () => {
  it("принимает компетенцию с 2 знаниями, 1 навыком и принятым источником", () => {
    const evaluation = evaluateRelease(inputs(), { asOf });
    assert.equal(evaluation.totals.passed, true);
    assert.equal(evaluation.totals.publishedLinks, 1);
    assert.equal(evaluation.totals.blockingGaps, 0);
  });

  it("ловит неполный состав", () => {
    const value = inputs();
    value.catalog.blocks[0]!.tags = [tag("k1", "knowledge"), tag("s1", "skill")];
    const evaluation = evaluateRelease(value, { asOf });
    assert.equal(evaluation.totals.passed, false);
    assert.ok(evaluation.gaps.some((gap) => gap.type === "composition"));
  });

  it("в draft-режиме не блокирует отсутствие source review, но в strict — блокирует", () => {
    const value = inputs({
      review: {
        reviewVersion: "1.0.0",
        releaseId: "test-release",
        updatedAt: "2026-10-28",
        reviewedBy: null,
        decisions: [],
      },
    });
    const draft = evaluateRelease(value, { asOf, strictSourceReview: false });
    assert.equal(draft.totals.passed, true);
    assert.ok(draft.gaps.some((gap) => gap.type === "source_review_missing" && !gap.blocking));
    const strict = evaluateRelease(value, { asOf, strictSourceReview: true });
    assert.equal(strict.totals.passed, false);
    assert.ok(strict.gaps.some((gap) => gap.type === "source_review_missing" && gap.blocking));
  });


  it("применяет общее решение source review без professionId", () => {
    const value = inputs({
      review: {
        reviewVersion: "1.0.0",
        releaseId: "test-release",
        updatedAt: "2026-10-28",
        reviewedBy: "founder",
        decisions: [
          {
            competencyId: "test-one",
            sourceId: "source-1",
            decision: "accepted",
            reviewedBy: "founder",
            reviewedAt: "2026-10-28",
          },
        ],
      },
    });
    const evaluation = evaluateRelease(value, { asOf, strictSourceReview: true });
    assert.equal(evaluation.totals.passed, true);
    assert.ok(!evaluation.gaps.some((gap) => gap.type === "source_review_missing"));
  });

  it("исключает AI-слой по префиксу", () => {
    const value = inputs();
    value.professionFiles.get("it.test")!.competencies.push({
      competencyId: "ai-model-landscape",
      tier: "core",
      order: 3,
      prerequisites: [],
    });
    value.competencies.competencies.push(competency("ai-model-landscape", "AI"));
    const evaluation = evaluateRelease(value, { asOf });
    assert.ok(evaluation.excluded.some((item) => item.competencyId === "ai-model-landscape"));
    assert.ok(!evaluation.professions[0]!.rows.some((row) => row.competency.id === "ai-model-landscape"));
  });

  it("фильтрует непрошедшие компетенции при сборке публичного контента", () => {
    const value = inputs({ extraCompetency: true });
    value.catalog.blocks.push(
      block("block-two", "test-two", [tag("k3", "knowledge")]),
    );
    const evaluation = evaluateRelease(value, { asOf });
    assert.equal(evaluation.totals.publishedLinks, 1);
    const content = buildPublicContent(value, evaluation);
    assert.equal(content.professions[0]!.coverage.published, 1);
    assert.equal(content.professions[0]!.coverage.total, 2);
    assert.equal(content.professions[0]!.sections[0]!.competencies.length, 1);
    assert.equal(content.professions[0]!.sections[0]!.competencies[0]!.id, "test-one");
  });
});
