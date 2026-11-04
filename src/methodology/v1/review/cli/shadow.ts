/**
 * `npm run review:shadow -- --profession it.uxui`
 *
 * Считает политику приёмки на журнале расширения в shadow-режиме:
 * ничего не публикует, только показывает распределение исходов и сетку порогов.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { buildShadowReport } from "../shadow.ts";
import { buildReviewContext, signalsFromCandidate } from "../signals.ts";

const root = process.cwd();
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
};

const professionArg = flag("--profession") ?? "it.uxui";
const professionId = professionArg.includes(".") ? professionArg : `it.${professionArg}`;
const slug = professionId.split(".")[1] ?? professionId;
const asJson = argv.includes("--json");
const noWrite = argv.includes("--no-write");

const journalSchema = z
  .object({
    professionId: z.string(),
    generatedOn: z.string().optional(),
    candidates: z.array(z.record(z.unknown())),
  })
  .passthrough();

async function main(): Promise<void> {
  const dir = resolve(root, "data/learning-sources");
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter(
      (file) => file.startsWith(`expansion-${slug}-`) && file.endsWith(".json"),
    );
  } catch {
    files = [];
  }
  const journalFile = files.sort().at(-1);
  if (!journalFile) {
    console.error(`нет журнала расширения для ${professionId}: сначала npm run sources:expand -- --profession ${slug}`);
    process.exit(1);
  }

  const journal = journalSchema.parse(JSON.parse(await readFile(join(dir, journalFile), "utf8")));
  const context = buildReviewContext(root);
  const signals = journal.candidates.map((candidate) =>
    signalsFromCandidate(candidate as never, context),
  );
  const report = buildShadowReport(signals);

  if (asJson) {
    console.log(JSON.stringify({ journal: journalFile, report }, null, 2));
  } else {
    console.log(`Shadow-приёмка · ${professionId} · ${journalFile}`);
    console.log(`кандидатов: ${report.total} · политика ${report.policyVersion}\n`);
    console.log("исходы:");
    for (const [outcome, count] of Object.entries(report.outcomes)) {
      const share = report.total === 0 ? 0 : Math.round((count / report.total) * 100);
      console.log(`  ${outcome.padEnd(14)} ${String(count).padStart(4)}  ${String(share).padStart(3)}%`);
    }
    console.log(`\nопубликовано: ${report.published} · скрыто: ${report.hidden} · с бейджем: ${report.badged}`);
    console.log("\nпричины:");
    for (const reason of report.reasons.slice(0, 8)) {
      console.log(`  ${reason.reason.padEnd(34)} ${reason.count}`);
    }
    console.log("\nсетка порогов (auto_accept):");
    console.log("  conf \\ rel   " + [0.4, 0.5, 0.6, 0.7].map((value) => String(value).padStart(6)).join(""));
    for (const confidence of [0.75, 0.8, 0.85, 0.9]) {
      const row = report.grid.filter((cell) => cell.confidence === confidence);
      console.log(
        `  ${confidence.toFixed(2)}        ` +
          row.map((cell) => `${cell.autoAccept}(${Math.round(cell.share * 100)}%)`.padStart(6)).join(""),
      );
    }
    if (report.warnings.length > 0) {
      console.log("\nпредупреждения:");
      for (const warning of report.warnings) console.log(`  · ${warning}`);
    }
  }

  if (!noWrite) {
    const outDir = resolve(root, "data/reviews");
    await mkdir(outDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const outFile = join(outDir, `shadow-${slug}-${date}.json`);
    await writeFile(
      outFile,
      `${JSON.stringify({ journal: journalFile, signals, report }, null, 2)}\n`,
      "utf8",
    );
    if (!asJson) console.log(`\nотчёт: data/reviews/shadow-${slug}-${date}.json`);
  }
}

main().catch((error: unknown) => {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
