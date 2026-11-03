import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Material } from "../src/methodology/v1/competency/types.ts";
import {
  COVERAGE_LIMITS,
  formatOf,
  resolveFormatCoverage,
  targetForTier,
} from "../src/methodology/v1/materials-agent/limits.ts";
import { buildCoverageReport } from "../src/methodology/v1/materials-agent/coverage.ts";

function material(id: string, kind: Material["kind"], blockId = "b1"): Material {
  return {
    id,
    slug: id,
    kind,
    title: `Материал ${id}`,
    provider: "Wikipedia",
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    language: "ru",
    access: "free",
    description: "Описание",
    license: "CC BY-SA",
    sourceRef: {
      sourceId: "wikipedia",
      externalId: id,
      url: `https://example.com/${id}`,
      retrievedAt: "2026-11-03",
      license: "CC BY-SA",
    },
    retrievedAt: "2026-11-03",
    links: [{ competencyId: blockId, relevance: 0.8, reason: "По теме.", modelProposal: false }],
    discoveredFor: [blockId],
    status: "accepted",
    issues: [],
  };
}

describe("форматы и цели", () => {
  it("маппит виды материалов на форматы вкладок", () => {
    assert.equal(formatOf("course"), "course");
    assert.equal(formatOf("video"), "video");
    assert.equal(formatOf("podcast"), "video");
    assert.equal(formatOf("article"), "article");
    assert.equal(formatOf("book"), "reference");
    assert.equal(formatOf("exercise"), "case");
  });

  it("цель по тиру остаётся в границах 2–5", () => {
    assert.equal(targetForTier("foundation"), 5);
    assert.equal(targetForTier("core"), 3);
    assert.equal(targetForTier("optional"), 2);
  });
});

describe("статус покрытия формата", () => {
  it("цель достигнута — ok", () => {
    assert.equal(resolveFormatCoverage({ accepted: 3, attempts: 1, tier: "core" }).status, "ok");
    assert.equal(resolveFormatCoverage({ accepted: 2, attempts: 1, tier: "core" }).status, "ok");
  });

  it("попыток не было — not_started", () => {
    assert.equal(resolveFormatCoverage({ accepted: 0, attempts: 0, tier: "core" }).status, "not_started");
  });

  it("искали, но не нашли — below_min, затем insufficient", () => {
    assert.equal(resolveFormatCoverage({ accepted: 0, attempts: 1, tier: "core" }).status, "below_min");
    const exhausted = resolveFormatCoverage({
      accepted: 0,
      attempts: COVERAGE_LIMITS.maxFormatRounds,
      tier: "core",
      lastAttemptAt: "2026-11-03",
    });
    assert.equal(exhausted.status, "insufficient");
    assert.equal(exhausted.nextAttemptAt, "2026-12-03");
  });
});

describe("отчёт покрытия", () => {
  it("считает принятые материалы по форматам и не маскирует пробелы", () => {
    const report = buildCoverageReport({
      professionId: "it.motion",
      competencies: [
        { competencyId: "motion-animation-principles", title: "Принципы анимации", tier: "core", blockIds: ["b1"] },
        { competencyId: "motion-sound-design", title: "Звуковой дизайн", tier: "core", blockIds: ["b2"] },
      ],
      materials: [material("a1", "article"), material("a2", "article"), material("a3", "article")],
      state: {
        "motion-sound-design": { video: { attempts: 3, lastAttemptAt: "2026-11-03" } },
      },
      now: new Date("2026-11-10"),
    });
    const principles = report.rows.find((row) => row.competencyId === "motion-animation-principles")!;
    const articles = principles.formats.find((format) => format.format === "article")!;
    assert.equal(articles.accepted, 3);
    assert.equal(articles.status, "ok");
    const video = principles.formats.find((format) => format.format === "video")!;
    assert.equal(video.status, "not_started");

    const sound = report.rows.find((row) => row.competencyId === "motion-sound-design")!;
    const soundVideo = sound.formats.find((format) => format.format === "video")!;
    assert.equal(soundVideo.status, "insufficient");
    assert.equal(report.totals.acceptedMaterials, 3);
  });
});
