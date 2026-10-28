import process from "node:process";
import path from "node:path";
import { evaluateRelease, loadReleaseInputs, writeGapReport } from "./lib.ts";

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
  const evaluation = evaluateRelease(inputs, { strictSourceReview: !allowDraft });

  if (hasFlag(argv, "--json")) {
    console.log(JSON.stringify(evaluation, null, 2));
  } else {
    console.log(
      `release:${evaluation.releaseId} ${evaluation.status}; professions ${evaluation.totals.professions}; ` +
        `links ${evaluation.totals.includedLinks}/${evaluation.totals.totalLinks}; ` +
        `published ${evaluation.totals.publishedLinks}; unique ${evaluation.totals.uniquePublishedCompetencies}/${evaluation.totals.uniqueCompetencies}; ` +
        `gaps ${evaluation.totals.blockingGaps}/${evaluation.totals.gaps}; ` +
        `gate ${evaluation.totals.passed ? "PASS" : "FAIL"}`,
    );
    for (const profession of evaluation.professions) {
      console.log(
        `  ${profession.title}: links ${profession.includedLinks}/${profession.totalLinks}, ` +
          `published ${profession.publishedLinks}, blocking ${profession.gaps.filter((gap) => gap.blocking).length}`,
      );
    }
    const byType = new Map<string, number>();
    for (const gap of evaluation.gaps) byType.set(gap.type, (byType.get(gap.type) ?? 0) + 1);
    const top = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    if (top.length > 0) {
      console.log(`  gaps: ${top.map(([type, count]) => `${type}=${count}`).join(", ")}`);
    }
  }

  if (hasFlag(argv, "--report")) {
    const paths = await writeGapReport(root, evaluation);
    console.log(`report: ${paths.markdownPath}`);
    console.log(`report json: ${paths.jsonPath}`);
  }

  if (!evaluation.totals.passed && !allowDraft) {
    console.error("release:validate: gate FAIL. Исправьте пробелы или используйте --allow-draft для чернового отчёта.");
    process.exitCode = 1;
  }
}

await main();
