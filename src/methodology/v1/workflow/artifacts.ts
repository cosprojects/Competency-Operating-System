/**
 * Артефакты шага: иммутабельны, адресуются по sha256.
 * Файловый sink — для локальных прогонов; в шаге 3 переедет на S3/MinIO.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ArtifactRef } from "../contracts/workflow.ts";

export type ArtifactContent = Omit<ArtifactRef, "id" | "createdAt">;

export interface ArtifactSink {
  put(content: string, meta: { kind: string; contentType: string }): Promise<ArtifactContent>;
  /** Прочитать артефакт по sha256 — нужно для передачи выхода между стадиями. */
  get(sha256: string): Promise<string | undefined>;
}

export function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export class FileArtifactSink implements ArtifactSink {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async put(content: string, meta: { kind: string; contentType: string }): Promise<ArtifactContent> {
    const digest = sha256(content);
    const dir = join(this.root, "data", "workflow", "artifacts");
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${digest}.json`);
    await writeFile(file, content, "utf8");
    return {
      kind: meta.kind as ArtifactContent["kind"],
      uri: `data/workflow/artifacts/${digest}.json`,
      sha256: digest,
      bytes: Buffer.byteLength(content, "utf8"),
      contentType: meta.contentType,
    };
  }

  async get(digest: string): Promise<string | undefined> {
    try {
      return await readFile(join(this.root, "data", "workflow", "artifacts", `${digest}.json`), "utf8");
    } catch {
      return undefined;
    }
  }
}

export class InMemoryArtifactSink implements ArtifactSink {
  readonly contents = new Map<string, string>();

  async get(digest: string): Promise<string | undefined> {
    return this.contents.get(digest);
  }

  async put(content: string, meta: { kind: string; contentType: string }): Promise<ArtifactContent> {
    const digest = sha256(content);
    this.contents.set(digest, content);
    return {
      kind: meta.kind as ArtifactContent["kind"],
      uri: `memory://${digest}`,
      sha256: digest,
      bytes: Buffer.byteLength(content, "utf8"),
      contentType: meta.contentType,
    };
  }
}
