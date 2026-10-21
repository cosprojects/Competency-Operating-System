import path from "node:path";
import type { CompetencyCandidate } from "../types.ts";
import type { CandidateGoldFile } from "../evaluate.ts";
import { evaluateCandidateGold } from "../evaluate.ts";
import { dataDir, flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession");
  const suffix = profession ? `-${profession}` : "";
  const goldPath = flagValue(argv, "--gold");
  if (!goldPath) throw new Error("Нужен --gold с независимой разметкой");
  const candidatesPath =
    flagValue(argv, "--candidates") ?? path.join(dataDir(root), `candidates-${domain}${suffix}.json`);
  const gold = await readJson<CandidateGoldFile>(goldPath);
  const file = await readJson<{ candidates: CompetencyCandidate[] }>(candidatesPath);
  const result = evaluateCandidateGold(gold, file.candidates);
  console.log(
    `Gold set: ${result.metrics.total}; TP=${result.metrics.truePositives}; FP=${result.metrics.falsePositives}; FN=${result.metrics.falseNegatives}; exact=${result.metrics.exact}`,
  );
  console.log(
    `precision=${result.metrics.precision.toFixed(3)}; recall=${result.metrics.recall.toFixed(3)}; exactRate=${result.metrics.exactRate.toFixed(3)}`,
  );
  for (const detail of result.details.filter((item) => item.verdict !== "true_positive")) {
    console.log(`  ${detail.tagId}: ожидалось «${detail.expected}», получено «${detail.predicted ?? "—"}» (${detail.verdict})`);
  }
  if (result.metrics.precision < 0.9 || result.metrics.recall < 0.7 || result.metrics.exactRate < 1) {
    process.exit(1);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
