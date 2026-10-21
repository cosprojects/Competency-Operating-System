import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { CompetencyBlock, Material } from "../types.ts";
import { classifyMaterials } from "../materials/classify.ts";
import { LlmBudget } from "../llm/policy.ts";
import { renderMaterialReview } from "../render.ts";
import { cacheDir, dataDir, flagValue, makeTransport, policyFromArgv, readJson, writeJson } from "./common.ts";

interface MaterialsFile {
  materials: Material[];
  coverage: Array<{ title: string; materials: number; kinds: Record<string, number> }>;
}
interface BlocksFile {
  blocks: CompetencyBlock[];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession");
  const suffix = profession ? `-${profession}` : "";
  const materialsPath = flagValue(argv, "--materials-file") ?? path.join(dataDir(root), `materials-${domain}${suffix}.json`);
  const materialsFile = await readJson<MaterialsFile>(materialsPath);
  let blocks: CompetencyBlock[];
  try {
    blocks = (await readJson<BlocksFile>(flagValue(argv, "--blocks-file") ?? path.join(dataDir(root), `blocks-${domain}${suffix}.json`))).blocks;
  } catch {
    blocks = (await readJson<{ blocks: CompetencyBlock[] }>(
      path.join(root, "src/methodology/v1/competency/catalog", `${domain}.json`),
    )).blocks;
  }

  if (argv.includes("--dry-run")) {
    console.log(`dry-run: материалов ${materialsFile.materials.length}; блоков ${blocks.length}`);
    return;
  }

  const policy = policyFromArgv(argv);
  const { transport, kind } = await makeTransport(argv, policy);
  const budget = new LlmBudget(policy);
  const result = await classifyMaterials({
    materials: materialsFile.materials,
    blocks,
    transport,
    policy,
    budget,
    ...(argv.includes("--no-cache") ? {} : { cache: { dir: cacheDir(root) } }),
    ...(flagValue(argv, "--limit") ? { limit: Number(flagValue(argv, "--limit")) } : {}),
  });
  const output = path.join(dataDir(root), `materials-classified-${domain}${suffix}.json`);
  await writeJson(output, {
    domain,
    generatedOn: new Date().toISOString().slice(0, 10),
    writesToGraph: false,
    transport: kind,
    materials: result.materials,
    issues: result.issues,
    runs: result.runs,
    budget: { calls: budget.calls, costUsd: budget.costUsd },
  });
  const reviewPath = path.join(dataDir(root), "review", `materials-${domain}${suffix}.md`);
  await mkdir(path.dirname(reviewPath), { recursive: true });
  await writeFile(
    reviewPath,
    renderMaterialReview(result.materials, materialsFile.coverage ?? []),
    "utf8",
  );
  console.log(
    `Материалов: ${result.materials.length}; issues: ${result.issues.length}; вызовов: ${budget.calls}; $${budget.costUsd.toFixed(4)}`,
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
