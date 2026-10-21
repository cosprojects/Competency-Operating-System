import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { CanonicalMap } from "../canonical/types.ts";
import { validateCanonicalMap } from "../canonical/validate.ts";
import { renderCanonicalCoverage } from "../canonical/report.ts";
import { professionIdOf, professionSlugOf, resolvePriorityBlocks, type PriorityBlockSource } from "../priority/source.ts";
import { dataDir, flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = professionIdOf(domain, profession);
  const slug = professionSlugOf(professionId);
  const mapPath =
    flagValue(argv, "--map-file") ??
    path.join(root, "src/methodology/v1/competency/canonical", `${slug}.json`);
  const map = await readJson<CanonicalMap>(mapPath);
  const resolved = await resolvePriorityBlocks({
    root,
    domain,
    profession,
    source: (flagValue(argv, "--source") as PriorityBlockSource | "auto" | undefined) ?? "auto",
    ...(flagValue(argv, "--blocks-file") ? { blocksFile: flagValue(argv, "--blocks-file")! } : {}),
    ...(argv.includes("--include-seed") ? { includeSeed: true } : {}),
  });
  const result = validateCanonicalMap(map, {
    blocks: resolved.blocks,
    requireUxUiBranches: professionId === "it.uxui",
  });
  console.log(
    `Карта ${professionId}: компетенций ${result.coverage.total}; covered ${result.coverage.covered}; partial ${result.coverage.partial}; gap ${result.coverage.gap}; ошибок ${result.errors.length}; предупреждений ${result.warnings.length}`,
  );
  for (const error of result.errors) console.error(`  ошибка: ${error}`);
  for (const warning of result.warnings) console.log(`  предупреждение: ${warning}`);
  if (argv.includes("--report")) {
    const output = path.join(dataDir(root), "canonical", `${domain}-${slug}-coverage.md`);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, renderCanonicalCoverage(map, result), "utf8");
    console.log(output);
  }
  if (result.errors.length > 0) process.exit(1);
  console.log(mapPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
