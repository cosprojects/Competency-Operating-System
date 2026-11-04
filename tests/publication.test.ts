import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { FsPublicationStore, PUBLICATION_VERSION, type PublicationRecord } from "../src/methodology/v1/release/publication.ts";
import { publishReleaseHandler } from "../src/methodology/v1/workflow/stages-publish.ts";

function record(overrides: Partial<PublicationRecord> = {}): PublicationRecord {
  return {
    publicationVersion: PUBLICATION_VERSION,
    releaseId: "beta-test",
    snapshotHash: "a".repeat(64),
    publishedAt: "2026-11-04T12:00:00Z",
    policyVersion: "1.0.0",
    stats: { nodes: 805, edges: 1418, materials: 43, nodeDuplicatesStrong: 0, nodeDuplicatesWeak: 4 },
    snapshot: {
      contractVersion: "1.0.0",
      modelVersion: "1.0.0",
      generatedAt: "2026-11-04T12:00:00Z",
      nodes: [],
      edges: [],
    },
    ...overrides,
  };
}

async function makeRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "cos-pub-"));
}

describe("публикация релиза", () => {
  it("пишет иммутабельный файл, указатель и индекс", async () => {
    const root = await makeRoot();
    const store = new FsPublicationStore(root);
    const result = await store.publish(record());
    assert.equal(result.created, true);
    assert.equal(result.path, "release/publications/beta-test.json");

    const current = await store.readCurrent();
    assert.equal(current?.releaseId, "beta-test");

    const index = JSON.parse(await readFile(join(root, "release/publications/index.json"), "utf8")) as {
      publications: Array<{ releaseId: string }>;
    };
    assert.equal(index.publications.length, 1);
  });

  it("повторная публикация с тем же хэшем идемпотентна", async () => {
    const root = await makeRoot();
    const store = new FsPublicationStore(root);
    await store.publish(record());
    const second = await store.publish(record({ publishedAt: "2026-11-05T00:00:00Z" }));
    assert.equal(second.created, false);
    const index = JSON.parse(await readFile(join(root, "release/publications/index.json"), "utf8")) as {
      publications: unknown[];
    };
    assert.equal(index.publications.length, 1);
  });

  it("перезапись тем же id с другим содержимым запрещена", async () => {
    const root = await makeRoot();
    const store = new FsPublicationStore(root);
    await store.publish(record());
    await assert.rejects(
      () => store.publish(record({ snapshotHash: "b".repeat(64) })),
      (error: unknown) => error instanceof Error && error.message.includes("иммутабельна"),
    );
  });

  it("промоушен фиксируется в записи", async () => {
    const root = await makeRoot();
    const store = new FsPublicationStore(root);
    await store.publish(record());
    await store.markPromoted("beta-test", "c".repeat(64));
    const updated = await store.read("beta-test");
    assert.ok(updated?.promotedAt);
    assert.equal(updated?.webContentSha256, "c".repeat(64));
    const list = await store.list();
    assert.ok(list[0]?.promotedAt);
  });
});

describe("публикация внутри стадии", () => {
  it("стадия публикует снимок, если передан store", async () => {
    const root = await makeRoot();
    const handler = publishReleaseHandler(process.cwd(), { publications: new FsPublicationStore(root) });
    const result = await handler({
      run: {} as never,
      step: {} as never,
      input: { releaseId: "beta-test" },
    });
    const output = result.output as { publication?: { releaseId: string; created: boolean } };
    assert.equal(output.publication?.releaseId, "beta-test");
    assert.equal(output.publication?.created, true);
    assert.ok(await new FsPublicationStore(root).read("beta-test"));
  });

  it("без store стадия работает как dry-run", async () => {
    const handler = publishReleaseHandler(process.cwd());
    const result = await handler({ run: {} as never, step: {} as never, input: { releaseId: "beta-dry" } });
    assert.equal((result.output as { publication?: unknown }).publication, undefined);
  });
});
