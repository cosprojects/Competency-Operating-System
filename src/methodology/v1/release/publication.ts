/**
 * COS-ARCH-175 — публикация релиза как иммутабельного артефакта.
 *
 * Прогон собирает снимок онтологии и публикует его:
 *   release/publications/<releaseId>.json — сам релиз (иммутабельный, адресуется хэшем);
 *   release/publications/index.json      — список релизов;
 *   release/publications/current.json    — указатель на действующий релиз.
 *
 * Повторная публикация того же id с другим содержимым запрещена: это новая версия,
 * а не перезапись. Промоушен в продукт — отдельный шаг (`release:promote`).
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { OntologySnapshot } from "../contracts/ontology.ts";

export const PUBLICATION_VERSION = "1.0.0" as const;

export type PublicationRecord = {
  publicationVersion: string;
  releaseId: string;
  snapshotHash: string;
  publishedAt: string;
  policyVersion: string;
  stats: {
    nodes: number;
    edges: number;
    materials: number;
    nodeDuplicatesStrong: number;
    nodeDuplicatesWeak: number;
  };
  snapshot: OntologySnapshot;
  /** Заполняется при промоушене: когда и с каким хэшем контент ушёл в продукт. */
  promotedAt?: string;
  webContentSha256?: string;
};

export type PublicationStore = {
  publish(record: PublicationRecord): Promise<{ path: string; currentPath: string; created: boolean }>;
  readCurrent(): Promise<PublicationRecord | undefined>;
  read(releaseId: string): Promise<PublicationRecord | undefined>;
  list(): Promise<Array<Pick<PublicationRecord, "releaseId" | "snapshotHash" | "publishedAt" | "promotedAt">>>;
  markPromoted(releaseId: string, webContentSha256: string): Promise<void>;
};

const DIR = "release/publications";

export class FsPublicationStore implements PublicationStore {
  private readonly root: string;

  constructor(root: string = process.cwd()) {
    this.root = resolve(root);
  }

  private path(releaseId: string): string {
    return join(this.root, DIR, `${releaseId}.json`);
  }

  async publish(record: PublicationRecord): Promise<{ path: string; currentPath: string; created: boolean }> {
    const dir = join(this.root, DIR);
    await mkdir(dir, { recursive: true });

    const existing = await this.read(record.releaseId);
    if (existing && existing.snapshotHash !== record.snapshotHash) {
      throw new Error(
        `релиз ${record.releaseId} уже опубликован с другим содержимым (${existing.snapshotHash.slice(0, 12)}). ` +
          "Публикация иммутабельна: заведите новый releaseId.",
      );
    }

    const file = this.path(record.releaseId);
    const created = !existing;
    if (created) await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");

    const indexFile = join(dir, "index.json");
    const index = await this.readIndex();
    if (!index.some((item) => item.releaseId === record.releaseId)) {
      index.push({
        releaseId: record.releaseId,
        snapshotHash: record.snapshotHash,
        publishedAt: record.publishedAt,
      });
      await writeFile(indexFile, `${JSON.stringify({ publications: index }, null, 2)}\n`, "utf8");
    }

    const currentFile = join(dir, "current.json");
    await writeFile(
      currentFile,
      `${JSON.stringify(
        {
          releaseId: record.releaseId,
          snapshotHash: record.snapshotHash,
          publishedAt: record.publishedAt,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    return { path: `${DIR}/${record.releaseId}.json`, currentPath: `${DIR}/current.json`, created };
  }

  async read(releaseId: string): Promise<PublicationRecord | undefined> {
    try {
      const body = JSON.parse(await readFile(this.path(releaseId), "utf8")) as PublicationRecord;
      return body.publicationVersion ? body : undefined;
    } catch {
      return undefined;
    }
  }

  async readCurrent(): Promise<PublicationRecord | undefined> {
    try {
      const pointer = JSON.parse(
        await readFile(join(this.root, DIR, "current.json"), "utf8"),
      ) as { releaseId?: string };
      return pointer.releaseId ? this.read(pointer.releaseId) : undefined;
    } catch {
      return undefined;
    }
  }

  async list(): Promise<Array<Pick<PublicationRecord, "releaseId" | "snapshotHash" | "publishedAt" | "promotedAt">>> {
    const dir = join(this.root, DIR);
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter(
        (file) => file.endsWith(".json") && file !== "index.json" && file !== "current.json",
      );
    } catch {
      return [];
    }
    const records: Array<Pick<PublicationRecord, "releaseId" | "snapshotHash" | "publishedAt" | "promotedAt">> = [];
    for (const file of files) {
      const record = await this.read(file.replace(/\.json$/, ""));
      if (!record) continue;
      records.push({
        releaseId: record.releaseId,
        snapshotHash: record.snapshotHash,
        publishedAt: record.publishedAt,
        ...(record.promotedAt ? { promotedAt: record.promotedAt } : {}),
      });
    }
    return records.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }

  async markPromoted(releaseId: string, webContentSha256: string): Promise<void> {
    const record = await this.read(releaseId);
    if (!record) throw new Error(`публикация ${releaseId} не найдена`);
    record.promotedAt = new Date().toISOString();
    record.webContentSha256 = webContentSha256;
    await writeFile(this.path(releaseId), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  }

  private async readIndex(): Promise<
    Array<{ releaseId: string; snapshotHash: string; publishedAt: string }>
  > {
    try {
      const body = JSON.parse(
        await readFile(join(this.root, DIR, "index.json"), "utf8"),
      ) as { publications?: Array<{ releaseId: string; snapshotHash: string; publishedAt: string }> };
      return body.publications ?? [];
    } catch {
      return [];
    }
  }
}
