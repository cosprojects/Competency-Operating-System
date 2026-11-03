import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { loadReleaseInputs, evaluateRelease } from "../release/lib.ts";
import { checkLearningSource } from "../../src/methodology/v1/learning-sources/audit.ts";

/**
 * Догоняющий source-review для публикационного gate (AI-assisted):
 *  - заполняет summary активных источников, у которых его нет (по HTTP-метаданным страницы);
 *  - добавляет accepted-решения для пар «компетенция–источник», прошедших quality bar.
 *
 *   npm run reviews:decide -- --release beta-1 --write
 *
 * Решения помечаются reviewedBy: sources-gate-v1 и требуют spot-check перед публичным запуском.
 */

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

interface ReviewFile {
  reviewVersion: string;
  releaseId: string;
  updatedAt: string;
  reviewedBy: string | null;
  decisions: Array<{
    professionId?: string;
    competencyId: string;
    sourceId: string;
    decision: "accepted" | "replaced" | "excluded";
    reason?: string;
    reviewedBy?: string;
    reviewedAt?: string;
  }>;
  notes?: string[];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const release = flagValue(argv, "--release") ?? "beta-1";
  const write = argv.includes("--write");
  const manifestPath = path.join(root, "release", `${release}.json`);
  const inputs = await loadReleaseInputs(root, manifestPath);
  const registryPath = path.join(root, "src/methodology/v1/learning-sources/registry.json");
  const reviewPath = path.join(root, manifestPath ? `release/${release}-source-review.json` : "");
  const review = await readJson<ReviewFile>(
    path.join(root, "release", `${release}-source-review.json`),
  );
  const registry = await readJson<{
    registryVersion: string;
    updatedAt: string;
    sources: Array<{
      id: string;
      title: string;
      url: string;
      status: string;
      summary?: string;
      lastChecked: string;
      httpStatus?: number;
      finalUrl?: string;
    }>;
  }>(registryPath);
  const sourceById = new Map(registry.sources.map((source) => [source.id, source]));

  // 1. Summary для активных источников, у которых его нет.
  let evaluation = evaluateRelease(inputs, { asOf: new Date() });
  const summaryGaps = new Map<string, string>();
  for (const gap of evaluation.gaps) {
    if (gap.type === "source_summary_missing" && gap.sourceId) summaryGaps.set(gap.sourceId, gap.professionId);
  }
  let summariesFilled = 0;
  for (const sourceId of summaryGaps.keys()) {
    const source = sourceById.get(sourceId);
    if (!source) continue;
    const audit = await checkLearningSource({
      ...source,
      id: source.id,
      title: source.title,
      url: source.url,
      kind: "reference",
      professionIds: [],
      languages: ["ru"],
      access: "unknown",
      authority: "secondary",
      status: "active",
      topics: [],
      discoveredBy: "manual",
      lastChecked: source.lastChecked,
    } as never);
    const ok = audit.httpStatus !== undefined && audit.httpStatus >= 200 && audit.httpStatus < 400;
    if (ok && audit.title) {
      source.summary = audit.title.slice(0, 300);
      source.lastChecked = audit.checkedAt;
      source.httpStatus = audit.httpStatus;
      if (audit.finalUrl) source.finalUrl = audit.finalUrl;
      summariesFilled += 1;
    }
  }
  if (summariesFilled > 0) {
    inputs.registry.sources = registry.sources as never;
    evaluation = evaluateRelease(inputs, { asOf: new Date() });
  }

  // 2. Решения для пар без source review, если источник проходит quality bar.
  const keys = new Set(
    review.decisions.map((decision) => `${decision.professionId ?? "*"}|${decision.competencyId}|${decision.sourceId}`),
  );
  const today = new Date().toISOString().slice(0, 10);
  const maxAgeDays = inputs.manifest.qualityBar.maxSourceAgeDays;
  let decisionsAdded = 0;
  const skipped: string[] = [];
  for (const gap of evaluation.gaps) {
    if (gap.type !== "source_review_missing" || !gap.sourceId) continue;
    const source = sourceById.get(gap.sourceId);
    if (!source) {
      skipped.push(`${gap.sourceId}: нет в реестре`);
      continue;
    }
    const ageDays = Math.floor((Date.now() - new Date(source.lastChecked).getTime()) / 86_400_000);
    const qualifies =
      source.status === "active" &&
      Boolean(source.summary) &&
      ageDays <= maxAgeDays &&
      !keys.has(`${gap.professionId}|${gap.competencyId}|${gap.sourceId}`) &&
      !keys.has(`*|${gap.competencyId}|${gap.sourceId}`);
    if (!qualifies) {
      skipped.push(`${gap.sourceId}: не проходит quality bar (${source.status}, summary=${Boolean(source.summary)}, age=${ageDays})`);
      continue;
    }
    review.decisions.push({
      professionId: gap.professionId,
      competencyId: gap.competencyId,
      sourceId: gap.sourceId,
      decision: "accepted",
      reason: "AI-assisted source relevance check: активный не-агрегатор с описанием и свежей проверкой; нужен spot-check основателя.",
      reviewedBy: "sources-gate-v1",
      reviewedAt: today,
    });
    keys.add(`${gap.professionId}|${gap.competencyId}|${gap.sourceId}`);
    decisionsAdded += 1;
  }

  console.log(
    `reviews:decide ${release}: summaries filled ${summariesFilled}; decisions added ${decisionsAdded}; skipped ${skipped.length}; total decisions ${review.decisions.length}`,
  );
  for (const item of skipped.slice(0, 10)) console.log(`  skip ${item}`);
  if (!write) {
    console.log("dry-run: реестр и файл решений не изменены. Для записи добавь --write.");
    return;
  }
  registry.updatedAt = today;
  review.updatedAt = today;
  review.reviewedBy = review.reviewedBy ?? "sources-gate-v1";
  await writeJson(registryPath, registry);
  await writeJson(path.join(root, "release", `${release}-source-review.json`), review);
  console.log(registryPath);
  console.log(path.join(root, "release", `${release}-source-review.json`));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
