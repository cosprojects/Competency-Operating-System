import path from "node:path";
import type { CatalogFile } from "../types.ts";
import type { PriorityFile } from "../priority/types.ts";
import { validateCatalog } from "../catalog.ts";
import { validatePriorityFile } from "../priority/validate.ts";
import { dataDir, flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const catalogPath = flagValue(argv, "--catalog") ?? path.join(root, "src/methodology/v1/competency/catalog", `${domain}.json`);
  const catalog = await readJson<CatalogFile>(catalogPath);
  const errors = validateCatalog(catalog);
  if (argv.includes("--require-priority")) {
    const professionSlug = flagValue(argv, "--profession") ?? "uxui";
    const priorityPath =
      flagValue(argv, "--priority-file") ??
      path.join(root, "src/methodology/v1/competency/priority", `${professionSlug}.json`);
    const priority = await readJson<PriorityFile>(priorityPath);
    const priorityResult = validatePriorityFile(priority, {
      blocks: catalog.blocks,
      requireComplete: true,
    });
    errors.push(...priorityResult.errors);
  }
  if (errors.length > 0) {
    console.error(`Каталог ${domain}: ошибок ${errors.length}`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(
    `Каталог ${domain}: ок. Блоков ${catalog.blocks.length}, тегов ${catalog.tags.length}, материалов ${catalog.materials.length}.`,
  );
  console.log(catalogPath);
  console.log(dataDir(root));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
