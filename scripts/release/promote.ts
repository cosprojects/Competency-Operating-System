/**
 * `npm run release:promote -- [--release <id>] [--allow-draft] [--dry-run]`
 *
 * Промоушен опубликованного релиза в продукт: прогоняет существующий release-гейт,
 * пересобирает публичный контент и штампует в него метаданные публикации
 * (releaseId, snapshotHash, дата). После этого веб-сборка видит новый контент.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { FsPublicationStore } from "../../src/methodology/v1/release/publication.ts";
import { buildPublicContent, evaluateRelease, loadReleaseInputs } from "./lib.ts";

const WEB_CONTENT_PATH = "apps/web/src/content/generated/beta-1.json";

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const dryRun = argv.includes("--dry-run");
  const allowDraft = argv.includes("--allow-draft");
  const publications = new FsPublicationStore(root);

  const requested = flagValue(argv, "--release");
  const publication = requested ? await publications.read(requested) : await publications.readCurrent();
  if (!publication) {
    throw new Error(
      requested
        ? `публикация ${requested} не найдена в release/publications/`
        : "нет текущей публикации: сначала прогоните конвейер (release.publish)",
    );
  }

  const manifestPath = join(root, "release", `${publication.releaseId}.json`);
  const inputs = await loadReleaseInputs(root, manifestPath);
  if (!allowDraft && inputs.manifest.status !== "ready") {
    throw new Error(`release:promote: манифест ${publication.releaseId} имеет status=${inputs.manifest.status}`);
  }

  const evaluation = evaluateRelease(inputs, { strictSourceReview: !allowDraft });
  if (!evaluation.totals.passed && !allowDraft) {
    throw new Error(
      `release:promote: gate FAIL (${evaluation.totals.blockingGaps} блокирующих пробелов) — промоушен остановлен`,
    );
  }

  const content = buildPublicContent(inputs, evaluation);
  const enriched = {
    ...content,
    publication: {
      releaseId: publication.releaseId,
      snapshotHash: publication.snapshotHash,
      publishedAt: publication.publishedAt,
      promotedAt: new Date().toISOString(),
      policyVersion: publication.policyVersion,
    },
  };
  const body = `${JSON.stringify(enriched, null, 2)}\n`;
  const webContentSha256 = createHash("sha256").update(body).digest("hex");

  console.log(`релиз: ${publication.releaseId} · snapshot ${publication.snapshotHash.slice(0, 12)}`);
  console.log(`контент: ${WEB_CONTENT_PATH} · sha256 ${webContentSha256.slice(0, 12)}`);
  console.log(`статистика: узлов ${publication.stats.nodes}, рёбер ${publication.stats.edges}, материалов ${publication.stats.materials}`);

  if (dryRun) {
    console.log("dry-run: файлы не записаны");
    return;
  }

  const file = resolve(root, WEB_CONTENT_PATH);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body, "utf8");
  await publications.markPromoted(publication.releaseId, webContentSha256);
  console.log("промоушен выполнен: контент обновлён, публикация отмечена");
}

main().catch((error: unknown) => {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
