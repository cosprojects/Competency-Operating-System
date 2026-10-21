import path from "node:path";
import type { CompetencyBlock, Material } from "../types.ts";
import { collectMaterials } from "../materials/collect.ts";
import { dataDir, flagValue, readJson, writeJson } from "./common.ts";

interface BlocksFile {
  blocks: CompetencyBlock[];
}
interface CatalogFile {
  blocks: CompetencyBlock[];
}
interface MaterialsFile {
  materials: Material[];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession");
  const suffix = profession ? `-${profession}` : "";
  const blocksPath =
    flagValue(argv, "--blocks-file") ?? path.join(dataDir(root), `blocks-${domain}${suffix}.json`);
  let blocks: CompetencyBlock[];
  try {
    blocks = (await readJson<BlocksFile>(blocksPath)).blocks;
  } catch {
    const catalog = await readJson<CatalogFile>(
      path.join(root, "src/methodology/v1/competency/catalog", `${domain}.json`),
    );
    blocks = catalog.blocks;
  }
  if (blocks.length === 0) throw new Error("Нет блоков: сначала competency:build или примите блоки в каталог");

  const fetchImpl = (input: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) =>
    fetch(input, init);
  const result = await collectMaterials({
    competencies: blocks,
    fetchImpl,
    retrievedOn: new Date().toISOString().slice(0, 10),
    ...(flagValue(argv, "--sources") ? { sourceIds: flagValue(argv, "--sources")!.split(",") } : {}),
    ...(process.env.YOUTUBE_API_KEY ? { youtubeApiKey: process.env.YOUTUBE_API_KEY } : {}),
  });
  const output = path.join(dataDir(root), `materials-${domain}${suffix}.json`);
  await writeJson(output, {
    domain,
    generatedOn: new Date().toISOString().slice(0, 10),
    writesToGraph: false,
    materials: result.materials,
    coverage: result.coverage,
    notes: result.notes,
  });
  const existing = await readJson<MaterialsFile>(output).catch(() => ({ materials: [] }));
  void existing;
  console.log(
    `Материалов: ${result.materials.length}; покрытие: ${result.coverage.filter((item) => item.materials > 0).length}/${result.coverage.length}; замечаний источников: ${result.notes.length}`,
  );
  for (const item of result.coverage) {
    console.log(`  ${item.title}: ${item.materials} (${JSON.stringify(item.kinds)})`);
  }
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
