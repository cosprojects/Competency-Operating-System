import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildReviewContext, signalFromReviewItem, signalsFromCandidate } from "../src/methodology/v1/review/signals.ts";
import { attachMaterialsHandler, materialIdFor } from "../src/methodology/v1/workflow/stages-attach.ts";
import { publishReleaseHandler } from "../src/methodology/v1/workflow/stages-publish.ts";
import { rewriteFormulationsHandler } from "../src/methodology/v1/workflow/stages-writer.ts";

const CATALOG = {
  catalogVersion: "1.0.0",
  blocks: [{ id: "comp_a", title: "Блок", definition: "Определение блока.", canonicalIds: ["ux-design-thinking"] }],
  materials: [
    {
      id: "material_existing",
      kind: "article",
      title: "Анализ требований",
      url: "https://habr.com/ru/articles/1/",
      provider: "Хабр",
      links: [{ competencyId: "comp_a" }],
    },
  ],
  tags: [],
};

const REGISTRY = {
  registryVersion: "1.0.0",
  sources: [{ id: "habr", title: "Хабр", url: "https://habr.com/", status: "active" }],
};

async function makeRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "cos-stages-"));
  await mkdir(join(dir, "src/methodology/v1/competency/model"), { recursive: true });
  await mkdir(join(dir, "src/methodology/v1/competency/catalog"), { recursive: true });
  await mkdir(join(dir, "src/methodology/v1/learning-sources"), { recursive: true });
  await writeFile(join(dir, "src/methodology/v1/competency/catalog/it.json"), JSON.stringify(CATALOG));
  await writeFile(join(dir, "src/methodology/v1/learning-sources/registry.json"), JSON.stringify(REGISTRY));
  return dir;
}

describe("единый построитель сигналов", () => {
  it("стадия и shadow считают одинаково (регресс: расхождение проверки домена)", async () => {
    const root = await makeRoot();
    const context = buildReviewContext(root);
    const fromItem = signalFromReviewItem(
      {
        materialId: "https://habr.com/ru/articles/9/",
        sourceId: "https://habr.com/ru/articles/9/",
        competencyId: "ux-design-thinking",
        confidence: 0.9,
        relevance: 0.85,
        verdict: "accept",
        kind: "article",
      },
      context,
    );
    const fromCandidate = signalsFromCandidate(
      {
        canonicalUrl: "https://habr.com/ru/articles/9/",
        title: "Статья",
        competencyId: "ux-design-thinking",
        review: { verdict: "accept", confidence: 0.9, usefulness: 0.85 },
      } as never,
      context,
    );
    assert.equal(fromItem.domain, fromCandidate.domain);
    assert.deepEqual(fromItem.domainHistory, fromCandidate.domainHistory);
    assert.equal(fromItem.domainHistory.known, true);
  });
});

describe("сценарий writer", () => {
  it("подтягивает определения из модели и отмечает короткие", async () => {
    const handler = rewriteFormulationsHandler(process.cwd());
    const result = await handler({
      run: {} as never,
      step: {} as never,
      input: { professionId: "it.uxui", nodeIds: ["ux-design-thinking", "no-such-node"] },
    });
    const output = result.output as {
      descriptions: Array<{ nodeId: string; source: string; meetsPolicy: boolean }>;
      missing: string[];
    };
    assert.equal(output.descriptions.length, 2);
    assert.equal(output.descriptions[0]?.source, "model");
    assert.equal(output.descriptions[0]?.meetsPolicy, true);
    assert.equal(output.descriptions[1]?.source, "missing");
    assert.deepEqual(output.missing, ["no-such-node"]);
  });
});

describe("сценарий attach: защита от дублей", () => {
  const decisions = (materialIds: string[]) =>
    materialIds.map((materialId) => ({
      materialId,
      nodeId: "ux-design-thinking",
      status: "accepted" as const,
      title: "Анализ требований",
    }));

  it("новый материал создаётся, дубль каталога переиспользуется", async () => {
    const root = await makeRoot();
    const handler = attachMaterialsHandler(root);
    const result = await handler({
      run: {} as never,
      step: {} as never,
      input: {
        professionId: "it.uxui",
        decisions: decisions([
          "https://skillbox.ru/course/new",
          "http://habr.com/ru/articles/1?utm_source=tg",
        ]),
      },
    });
    const output = result.output as {
      linked: Array<{ materialId: string; newMaterial: boolean; reused: boolean }>;
      duplicates: Array<{ kind: string }>;
      stats: { newMaterials: number; duplicates: number };
    };
    // Материал из каталога уже привязан к этой компетенции → новой связи не создаём.
    assert.equal(output.linked.length, 1);
    assert.equal(output.linked[0]?.newMaterial, true);
    const kinds = output.duplicates.map((duplicate) => duplicate.kind);
    assert.ok(kinds.includes("exact_url"));
    assert.ok(kinds.includes("link_exists"));
    assert.equal(output.stats.newMaterials, 1);
  });

  it("повторный прогон не создаёт новых материалов", async () => {
    const root = await makeRoot();
    const handler = attachMaterialsHandler(root);
    const input = { professionId: "it.uxui", decisions: decisions(["https://skillbox.ru/course/new"]) };
    await handler({ run: {} as never, step: {} as never, input });
    const second = await handler({ run: {} as never, step: {} as never, input });
    const output = second.output as { stats: { newMaterials: number; duplicates: number } };
    assert.equal(output.stats.newMaterials, 0);
    assert.ok(output.stats.duplicates >= 1);
  });

  it("дубль внутри пачки схлопывается", async () => {
    const root = await makeRoot();
    const handler = attachMaterialsHandler(root);
    const result = await handler({
      run: {} as never,
      step: {} as never,
      input: {
        professionId: "it.uxui",
        decisions: decisions(["https://skillbox.ru/x", "https://skillbox.ru/x?utm_source=a"]),
      },
    });
    const output = result.output as { stats: { newMaterials: number; duplicates: number } };
    assert.equal(output.stats.newMaterials, 1);
    assert.equal(output.stats.duplicates, 1);
  });

  it("id материала детерминирован по канонической ссылке", () => {
    assert.equal(
      materialIdFor("https://skillbox.ru/x?utm_source=tg"),
      materialIdFor("http://www.skillbox.ru/x/"),
    );
  });
});

describe("сценарий publish", () => {
  it("публикует снимок с детерминированным хэшем и статистикой", async () => {
    const handler = publishReleaseHandler(process.cwd());
    const first = await handler({
      run: {} as never,
      step: {} as never,
      input: { releaseId: "test-release" },
    });
    const output = first.output as {
      releaseId: string;
      snapshotHash: string;
      stats: { nodes: number; edges: number; materials: number; nodeDuplicates: number };
      snapshot: { contractVersion: string };
    };
    assert.equal(output.releaseId, "test-release");
    assert.match(output.snapshotHash, /^[a-f0-9]{64}$/);
    assert.ok(output.stats.nodes > 800);
    assert.ok(output.stats.edges > 600);
    assert.equal(typeof output.stats.nodeDuplicates, "number");
    assert.equal(output.snapshot.contractVersion, "1.0.0");
  });
});
