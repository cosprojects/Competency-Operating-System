import path from "node:path";
import type { PriorityFile } from "../priority/types.ts";
import { validatePriorityFile } from "../priority/validate.ts";
import { professionIdOf, professionSlugOf, resolvePriorityBlocks, type PriorityBlockSource } from "../priority/source.ts";
import { flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = professionIdOf(domain, profession);
  const priorityPath =
    flagValue(argv, "--priority-file") ??
    path.join(root, "src/methodology/v1/competency/priority", `${professionSlugOf(professionId)}.json`);
  const file = await readJson<PriorityFile>(priorityPath);
  const resolved = await resolvePriorityBlocks({
    root,
    domain,
    profession,
    source: (flagValue(argv, "--source") as PriorityBlockSource | "auto" | undefined) ?? "auto",
    ...(flagValue(argv, "--blocks-file") ? { blocksFile: flagValue(argv, "--blocks-file")! } : {}),
    ...(argv.includes("--include-seed") ? { includeSeed: true } : {}),
  });
  const result = validatePriorityFile(file, {
    blocks: resolved.blocks,
    ...(argv.includes("--require-complete") ? { requireComplete: true } : {}),
    ...(argv.includes("--require-accepted") ? { requireAccepted: true } : {}),
  });
  console.log(
    `Приоритеты ${professionId}: marks ${file.marks.length}; ошибок ${result.errors.length}; предупреждений ${result.warnings.length}; без метки ${result.missingCompetencyIds.length}`,
  );
  for (const warning of result.warnings) console.log(`  предупреждение: ${warning}`);
  for (const error of result.errors) console.error(`  ошибка: ${error}`);
  if (result.errors.length > 0) process.exit(1);
  console.log(priorityPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
