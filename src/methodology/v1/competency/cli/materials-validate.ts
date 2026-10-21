import path from "node:path";
import type { CompetencyBlock, Material } from "../types.ts";
import { validateMaterials } from "../materials/validate.ts";
import { dataDir, flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession");
  const suffix = profession ? `-${profession}` : "";
  const materialsPath = flagValue(argv, "--materials-file") ?? path.join(dataDir(root), `materials-${domain}${suffix}.json`);
  const materialsFile = await readJson<{ materials: Material[] }>(materialsPath).catch(() =>
    readJson<{ materials: Material[] }>(path.join(dataDir(root), `materials-classified-${domain}${suffix}.json`)),
  );
  let blocks: CompetencyBlock[];
  try {
    blocks = (await readJson<{ blocks: CompetencyBlock[] }>(flagValue(argv, "--blocks-file") ?? path.join(dataDir(root), `blocks-${domain}${suffix}.json`))).blocks;
  } catch {
    blocks = (await readJson<{ blocks: CompetencyBlock[] }>(
      path.join(root, "src/methodology/v1/competency/catalog", `${domain}.json`),
    )).blocks;
  }
  const result = validateMaterials(materialsFile.materials, blocks);
  console.log(`Материалов: ${materialsFile.materials.length}; ошибок: ${result.errors.length}`);
  for (const error of result.errors) console.log(`  - ${error}`);
  for (const coverage of result.coverage) {
    console.log(
      `  ${coverage.title}: ${coverage.materials} (${JSON.stringify(coverage.kinds)}), free=${coverage.hasFree}, paid=${coverage.hasPaid}`,
    );
  }
  if (argv.includes("--require-coverage") && result.coverage.some((item) => item.materials === 0)) {
    process.exit(1);
  }
  if (result.errors.length > 0) process.exit(1);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
