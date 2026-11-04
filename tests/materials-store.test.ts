import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { FileMaterialsStore } from "../src/methodology/v1/materials/store-file.ts";
import { InMemoryMaterialsStore } from "../src/methodology/v1/materials/store-memory.ts";
import { createReviewHandler } from "../src/methodology/v1/review/handler.ts";

describe("файловое хранилище", () => {
  it("экземпляры на разных путях не делят состояние (регресс: шаринг пустого массива)", async () => {
    const dirA = await mkdtemp(join(tmpdir(), "cos-store-a-"));
    const dirB = await mkdtemp(join(tmpdir(), "cos-store-b-"));
    const a = new FileMaterialsStore(join(dirA, "attached.json"));
    const b = new FileMaterialsStore(join(dirB, "attached.json"));

    await a.addMaterial({ id: "material_1", canonicalUrl: "https://a.ru/1", url: "https://a.ru/1", title: "A" });
    assert.equal((await a.listMaterials()).length, 1);
    assert.equal((await b.listMaterials()).length, 0);
  });

  it("пишет и читает привязки", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cos-store-"));
    const store = new FileMaterialsStore(join(dir, "attached.json"));
    await store.addLink("material_1", "ux-design-thinking");
    assert.equal(await store.hasLink("material_1", "ux-design-thinking"), true);
    assert.equal(await store.hasLink("material_1", "ui-color"), false);
  });
});

describe("память как хранилище", () => {
  it("дедуплицирует материалы и связи", async () => {
    const store = new InMemoryMaterialsStore();
    await store.addMaterial({ id: "material_1", canonicalUrl: "https://a.ru/1", url: "https://a.ru/1", title: "A" });
    assert.equal((await store.findMaterialByCanonicalUrl("https://a.ru/1"))?.id, "material_1");
    await store.addLink("material_1", "ux-design-thinking");
    await store.addLink("material_1", "ux-design-thinking");
    assert.equal(store.links.size, 1);
  });
});

describe("журнал решений приёмки", () => {
  it("приёмка пишет решения в хранилище с версией политики", async () => {
    const store = new InMemoryMaterialsStore();
    const handler = createReviewHandler(process.cwd(), { store });
    await handler({
      run: { id: "run_1" } as never,
      step: { id: "step_review" } as never,
      input: {
        professionId: "it.uxui",
        items: [
          {
            materialId: "https://habr.com/ru/articles/1/",
            title: "Анализ требований",
            competencyId: "ux-requirements",
            verdict: "accept",
            confidence: 0.9,
            relevance: 0.85,
            kind: "article",
          },
        ],
      },
    });
    assert.equal(store.reviews.length, 1);
    const batch = store.reviews[0];
    assert.equal(batch?.runId, "run_1");
    assert.equal(batch?.stepId, "step_review");
    assert.ok(batch?.policyVersion);
    assert.equal(batch?.decisions.length, 1);
    assert.ok(batch?.decisions[0]?.outcome);
    assert.ok(batch?.decisions[0]?.signalsJson?.includes("domainHistory"));
  });

  it("без хранилища приёмка работает как раньше", async () => {
    const handler = createReviewHandler(process.cwd());
    const result = await handler({
      run: { id: "run_1" } as never,
      step: { id: "step_review" } as never,
      input: {
        professionId: "it.uxui",
        items: [
          {
            materialId: "https://habr.com/ru/articles/1/",
            title: "Анализ требований",
            competencyId: "ux-requirements",
            verdict: "accept",
            confidence: 0.9,
            relevance: 0.85,
          },
        ],
      },
    });
    assert.equal((result.output as { decisions: unknown[] }).decisions.length, 1);
  });
});
