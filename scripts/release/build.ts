import process from "node:process";
import path from "node:path";
import { buildPublicContent, evaluateRelease, loadReleaseInputs, writePublicContent } from "./lib.ts";

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const release = flagValue(argv, "--release") ?? "beta-1";
  const manifestPath = release.endsWith(".json")
    ? path.resolve(root, release)
    : path.join(root, "release", `${release}.json`);
  const allowDraft = hasFlag(argv, "--allow-draft");
  const inputs = await loadReleaseInputs(root, manifestPath);

  if (!allowDraft && inputs.manifest.status !== "ready") {
    throw new Error(
      `release:build: манифест ${inputs.manifest.releaseId} имеет status=${inputs.manifest.status}. ` +
        "Публичная сборка разрешена только для status=ready; для локального preview используйте --allow-draft.",
    );
  }

  const evaluation = evaluateRelease(inputs, { strictSourceReview: !allowDraft });
  if (!evaluation.totals.passed && !allowDraft) {
    throw new Error(
      `release:build: gate FAIL (${evaluation.totals.blockingGaps} блокирующих пробелов). ` +
        "Сначала release:validate, затем повторите сборку.",
    );
  }

  const content = buildPublicContent(inputs, evaluation);
  if (content.stats.publishedLinks === 0) {
    throw new Error("release:build: нет ни одной опубликованной компетенции; сборка остановлена.");
  }
  if (allowDraft) {
    content.status = "draft";
    for (const profession of content.professions) {
      profession.coverage.percent = profession.coverage.total
        ? Math.round((profession.coverage.published / profession.coverage.total) * 100)
        : 0;
    }
  }

  const file = await writePublicContent(root, content);
  console.log(
    `release:build: ${file}; status ${content.status}; professions ${content.stats.professions}; ` +
      `competencies ${content.stats.publishedCompetencies}; links ${content.stats.publishedLinks}; sources ${content.stats.sources}`,
  );
  for (const profession of content.professions) {
    console.log(
      `  ${profession.title}: ${profession.coverage.published}/${profession.coverage.total} (${profession.coverage.percent}%)`,
    );
  }
  if (allowDraft) {
    console.log("release:build: DRAFT preview; не публиковать без release:validate и status=ready.");
  }
}

await main();
