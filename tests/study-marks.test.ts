import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { studyMarkSchema } from "../apps/web/src/lib/validation.ts";

interface ClusterItem {
  id: string;
  status: "ok" | "no_data";
  sections: Array<{ heading: string; text: string }>;
  sources: Array<{ title: string; url: string; lang: string }>;
  promptVersion: string;
}

interface Cluster {
  items: Record<string, ClusterItem>;
  promptVersion: string;
}

const root = process.cwd();
const cluster = JSON.parse(
  readFileSync(path.join(root, "src/methodology/v1/guides/content/it.json"), "utf8"),
) as Cluster;
const generated = JSON.parse(
  readFileSync(path.join(root, "apps/web/src/content/generated/guides.json"), "utf8"),
) as Cluster;

describe("study marks", () => {
  it("валидирует тип цели, id и статус", () => {
    assert.equal(studyMarkSchema.safeParse({ targetType: "KNOWLEDGE", targetId: "tag_1", status: "LEARNED" }).success, true);
    assert.equal(studyMarkSchema.safeParse({ targetType: "SKILL", targetId: "tag_1", status: "LEARNING" }).success, true);
    assert.equal(studyMarkSchema.safeParse({ targetType: "COMPETENCY", targetId: "ux-design-thinking", status: "NOT_STARTED" }).success, true);
    assert.equal(studyMarkSchema.safeParse({ targetType: "SOURCE", targetId: "tag_1", status: "LEARNED" }).success, false);
    assert.equal(studyMarkSchema.safeParse({ targetType: "KNOWLEDGE", targetId: "", status: "LEARNED" }).success, false);
    assert.equal(studyMarkSchema.safeParse({ targetType: "KNOWLEDGE", targetId: "tag_1", status: "DONE" }).success, false);
  });
});

describe("guides cluster", () => {
  it("содержит валидные разборы и совпадает с generated/guides.json", () => {
    const items = Object.values(cluster.items);
    assert.ok(items.length >= 40, `в кластере ${items.length} пунктов`);
    const ok = items.filter((item) => item.status === "ok");
    assert.ok(ok.length > items.length / 2);
    for (const item of ok.slice(0, 10)) {
      assert.ok(item.sections.length >= 3, `${item.id}: мало разделов`);
      assert.ok(item.sections.every((section) => section.text.length >= 180), `${item.id}: короткий раздел`);
      assert.ok(item.sources.length >= 1, `${item.id}: нет источников`);
    }
    assert.equal(cluster.promptVersion, generated.promptVersion);
    assert.deepEqual(Object.keys(generated.items).sort(), Object.keys(cluster.items).sort());
  });
});
