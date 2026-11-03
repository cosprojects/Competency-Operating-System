import path from "node:path";
import type { Material, CompetencyBlock } from "../../competency/types.ts";
import type { CompetenciesFile, ProfessionCompetencyFile } from "../../competency/model/types.ts";
import { loadCatalog } from "../../competency/catalog.ts";
import { LlmBudget } from "../../competency/llm/policy.ts";
import {
  cacheDir,
  flagValue,
  makeTransport,
  policyFromArgv,
  readJson,
  writeJson,
} from "../../competency/cli/common.ts";
import { formatOf } from "../limits.ts";
import { reviewMaterials } from "../verdict.ts";

/**
 * Pass E: LLM-ревью и вердикты по найденным материалам.
 *
 *   npm run materials:verify -- --domain it --profession motion --journal data/materials-agent/it-motion-queue.json
 *
 * Пишет журнал с `review` у каждого материала; каталог не меняет.
 * Дальше — `materials:accept --journal data/materials-agent/it-motion-verified.json --write`.
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const slug = profession.includes(".") ? profession.slice(profession.indexOf(".") + 1) : profession;
  const professionId = `${domain}.${slug}`;
  const journalPath =
    flagValue(argv, "--journal") ?? path.join(root, "data/materials-agent", `${domain}-${slug}-queue.json`);
  const journal = await readJson<{ materials: Material[] }>(journalPath).catch(() => undefined);
  if (!journal || !Array.isArray(journal.materials)) {
    throw new Error(`Нет журнала материалов: ${journalPath}. Сначала materials:agent:queue.`);
  }
  const catalog = await loadCatalog(root, domain);
  const blocks = catalog.blocks.filter((block: CompetencyBlock) => block.status === "accepted");
  const modelDir = path.join(root, "src/methodology/v1/competency/model");
  const professionCompetencies = await readJson<ProfessionCompetencyFile>(
    path.join(modelDir, "profession-competencies", `${slug}.json`),
  ).catch(() => undefined);
  const tierByCompetency = new Map<string, "foundation" | "core" | "optional">();
  for (const competency of professionCompetencies?.competencies ?? []) {
    tierByCompetency.set(competency.competencyId, competency.tier);
  }
  const acceptedByFormat = new Map<string, number>();
  for (const material of catalog.materials) {
    if (material.status !== "accepted") continue;
    const format = formatOf(material.kind);
    for (const link of material.links) {
      const key = `${link.competencyId}|${format}`;
      acceptedByFormat.set(key, (acceptedByFormat.get(key) ?? 0) + 1);
    }
  }

  const policy = policyFromArgv(argv);
  const { transport, kind } = await makeTransport(argv, policy);
  const limit = flagValue(argv, "--limit") ? Number(flagValue(argv, "--limit")) : undefined;
  const retrievedOn = new Date().toISOString().slice(0, 10);
  const result = await reviewMaterials({
    materials: journal.materials,
    blocks,
    transport,
    policy,
    budget: new LlmBudget(policy),
    retrievedOn,
    cache: { dir: cacheDir(root) },
    ...(limit !== undefined ? { limit } : {}),
    ...(professionCompetencies ? { tierByCompetency } : {}),
    acceptedByFormat,
  });

  const totals = {
    materials: result.materials.length,
    reviewed: result.materials.filter((material) => material.review?.verdict).length,
    accepted: result.materials.filter((material) => material.review?.status === "accepted").length,
    needsConfirmation: result.materials.filter(
      (material) => material.review?.status === "needs_confirmation",
    ).length,
    rejected: result.materials.filter((material) => material.review?.status === "rejected").length,
    calls: result.runs.length,
    costUsd: result.runs.reduce((sum, run) => sum + run.costUsd, 0),
  };
  const out = path.join(root, "data/materials-agent", `${domain}-${slug}-verified.json`);
  await writeJson(out, {
    generatedOn: retrievedOn,
    professionId,
    transport: kind,
    writesToGraph: false,
    totals,
    issues: result.issues,
    runs: result.runs,
    materials: result.materials,
  });
  console.log(
    `materials:verify ${professionId}: reviewed ${totals.reviewed}/${totals.materials}; ` +
      `accepted ${totals.accepted}; needs_confirmation ${totals.needsConfirmation}; rejected ${totals.rejected}; ` +
      `calls ${totals.calls}; $${totals.costUsd.toFixed(4)}`,
  );
  for (const material of result.materials.slice(0, 10)) {
    if (!material.review) continue;
    console.log(
      `  ${material.review.verdict}/${material.review.confidence.toFixed(2)} — ${material.title}` +
        ` (${material.review.whyUseful})`,
    );
  }
  for (const issue of result.issues.slice(0, 10)) console.log(`  issue: ${issue}`);
  console.log(out);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
