import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildShadowReport } from "../src/methodology/v1/review/shadow.ts";
import { buildReviewContext, signalsFromCandidate } from "../src/methodology/v1/review/signals.ts";
import { reviewSignalSchema } from "../src/methodology/v1/review/policy.ts";

const CATALOG = {
  catalogVersion: "1.0.0",
  blocks: [
    { id: "comp_a", title: "Блок", definition: "Определение блока.", canonicalIds: ["ux-design-thinking"] },
  ],
  materials: [
    {
      id: "material_1",
      kind: "article",
      title: "Материал",
      url: "https://habr.com/ru/articles/1/",
      provider: "Хабр",
      access: "free",
      links: [{ competencyId: "comp_a" }],
    },
  ],
  tags: [],
};

const REGISTRY = {
  registryVersion: "1.0.0",
  sources: [
    { id: "habr", title: "Хабр", url: "https://habr.com/", status: "active", kind: "media" },
    { id: "bad", title: "Плохой", url: "https://spam.example/", status: "blocked", kind: "media" },
  ],
};

async function makeRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "cos-review-"));
  await mkdir(join(dir, "src/methodology/v1/competency/catalog"), { recursive: true });
  await mkdir(join(dir, "src/methodology/v1/learning-sources"), { recursive: true });
  await writeFile(join(dir, "src/methodology/v1/competency/catalog/it.json"), JSON.stringify(CATALOG));
  await writeFile(join(dir, "src/methodology/v1/learning-sources/registry.json"), JSON.stringify(REGISTRY));
  return dir;
}

describe("сигналы приёмки из реальных структур", () => {
  it("домен из реестра считается известным, заблокированный — блокирующим", async () => {
    const root = await makeRoot();
    const context = buildReviewContext(root);
    const known = signalsFromCandidate(
      {
        canonicalUrl: "https://habr.com/ru/articles/1/",
        title: "Статья",
        competencyId: "ux-design-thinking",
        review: { verdict: "accept", confidence: 0.9, usefulness: 0.85 },
      } as never,
      context,
    );
    assert.equal(known.domainHistory.known, true);
    assert.equal(known.relevance, 0.85);

    const blocked = signalsFromCandidate(
      { canonicalUrl: "https://spam.example/x", title: "Спам" } as never,
      context,
    );
    assert.equal(blocked.domainHistory.blocked, 1);
  });

  it("компетенция с принятым материалом помечается как имеющая базу", async () => {
    const root = await makeRoot();
    const context = buildReviewContext(root);
    const signal = signalsFromCandidate(
      {
        canonicalUrl: "https://habr.com/ru/articles/2/",
        title: "Статья",
        competencyId: "ux-design-thinking",
      } as never,
      context,
    );
    assert.equal(signal.competency.hasAcceptedMaterials, true);
  });
});

describe("shadow-отчёт", () => {
  it("считает распределение, причины и сетку порогов", async () => {
    const root = await makeRoot();
    const context = buildReviewContext(root);
    const signals = [
      signalsFromCandidate(
        {
          canonicalUrl: "https://habr.com/ru/articles/1/",
          title: "Статья",
          competencyId: "ux-design-thinking",
          review: { verdict: "accept", confidence: 0.9, usefulness: 0.85 },
        } as never,
        context,
      ),
      signalsFromCandidate(
        {
          canonicalUrl: "https://spam.example/x",
          title: "Спам",
          competencyId: "ux-design-thinking",
          review: { verdict: "accept", confidence: 0.9, usefulness: 0.85 },
        } as never,
        context,
      ),
    ];
    const report = buildShadowReport(signals);
    assert.equal(report.total, 2);
    assert.equal(report.outcomes.auto_accept, 1);
    assert.equal(report.outcomes.auto_reject, 1);
    assert.equal(report.published, 1);
    assert.ok(report.reasons.some((reason) => reason.reason === "domain_blocked"));
    assert.equal(report.grid.length, 16);
    assert.ok(report.grid.every((cell) => cell.autoAccept <= 2));
  });

  it("пустой набор не делит на ноль", () => {
    const report = buildShadowReport([reviewSignalSchema.parse({ materialId: "x", competency: {}, domainHistory: {} })]);
    assert.equal(report.total, 1);
    assert.ok(report.grid.every((cell) => cell.share >= 0));
  });
});
