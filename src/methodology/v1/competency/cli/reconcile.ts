import path from "node:path";
import type { CompetencyCandidate } from "../types.ts";
import { reconcileCandidates } from "../reconcile.ts";
import { loadCatalog } from "../catalog.ts";
import { LlmBudget } from "../llm/policy.ts";
import { renderCandidateReview } from "../render.ts";
import { cacheDir, dataDir, flagValue, makeTransport, policyFromArgv, readJson, writeJson } from "./common.ts";
import { mkdir, writeFile } from "node:fs/promises";

interface CandidatesFile {
  candidates: CompetencyCandidate[];
  unassignedTagIds: string[];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession");
  const suffix = profession ? `-${profession}` : "";
  const inputPath = flagValue(argv, "--candidates-file") ?? path.join(dataDir(root), `candidates-${domain}${suffix}.json`);
  const file = await readJson<CandidatesFile>(inputPath);
  if (argv.includes("--dry-run")) {
    console.log(`dry-run: кандидатов ${file.candidates.length}`);
    return;
  }
  const catalog = await loadCatalog(root, domain);
  const policy = policyFromArgv(argv);
  const { transport, kind } = await makeTransport(argv, policy);
  const budget = new LlmBudget(policy);
  const result = await reconcileCandidates({
    candidates: file.candidates,
    transport,
    policy,
    budget,
    ...(argv.includes("--no-cache") ? {} : { cache: { dir: cacheDir(root) } }),
    existingCatalogTitles: catalog.blocks.map((block) => block.title),
  });
  const output = path.join(dataDir(root), `candidates-reconciled-${domain}${suffix}.json`);
  await writeJson(output, {
    domain,
    generatedOn: new Date().toISOString().slice(0, 10),
    writesToGraph: false,
    transport: kind,
    candidates: result.candidates,
    unassignedTagIds: file.unassignedTagIds,
    unassignedCandidateIds: result.unassignedCandidateIds,
    issues: result.issues,
    runs: result.runs,
    budget: { calls: budget.calls, costUsd: budget.costUsd },
    stats: {
      inputCandidates: file.candidates.length,
      candidates: result.candidates.length,
      unassignedCandidates: result.unassignedCandidateIds.length,
    },
  });
  const reviewPath = path.join(dataDir(root), "review", `candidates-reconciled-${domain}${suffix}.md`);
  await mkdir(path.dirname(reviewPath), { recursive: true });
  await writeFile(reviewPath, renderCandidateReview(result.candidates, file.unassignedTagIds), "utf8");
  console.log(
    `Кандидатов: ${file.candidates.length} → ${result.candidates.length}; unassigned-кандидатов: ${result.unassignedCandidateIds.length}; issues: ${result.issues.length}; вызовов: ${budget.calls}; $${budget.costUsd.toFixed(4)}`,
  );
  console.log(output);
  console.log(reviewPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
