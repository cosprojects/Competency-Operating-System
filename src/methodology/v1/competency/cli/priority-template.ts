import path from "node:path";
import { readFile } from "node:fs/promises";
import type { PriorityFile } from "../priority/types.ts";
import { buildPriorityTemplate, renderPriorityTemplate } from "../priority/template.ts";
import { professionIdOf, professionSlugOf, resolvePriorityBlocks, type PriorityBlockSource } from "../priority/source.ts";
import { dataDir, flagValue, readJson, writeJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = professionIdOf(domain, profession);
  const requestedSource = (flagValue(argv, "--source") as PriorityBlockSource | "auto" | undefined) ?? "auto";
  const resolved = await resolvePriorityBlocks({
    root,
    domain,
    profession,
    source: requestedSource,
    ...(flagValue(argv, "--blocks-file") ? { blocksFile: flagValue(argv, "--blocks-file")! } : {}),
    ...(argv.includes("--include-seed") ? { includeSeed: true } : {}),
  });
  if (resolved.blocks.length === 0) throw new Error(`Нет блоков для ${professionId}`);

  const priorityPath = path.join(root, "src/methodology/v1/competency/priority", `${professionSlugOf(professionId)}.json`);
  let existing: PriorityFile | undefined;
  try {
    existing = JSON.parse(await readFile(priorityPath, "utf8")) as PriorityFile;
  } catch {
    existing = undefined;
  }
  const generatedOn = new Date().toISOString().slice(0, 10);
  const template = buildPriorityTemplate({
    domain,
    professionId,
    source: resolved.source,
    blocks: resolved.blocks,
    ...(existing ? { existing } : {}),
    generatedOn,
  });
  const outDir = path.join(dataDir(root), "priority");
  const base = path.join(outDir, `${domain}-${professionSlugOf(professionId)}-template`);
  await writeJson(`${base}.json`, template);
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(outDir, { recursive: true });
  await writeFile(`${base}.md`, renderPriorityTemplate(template), "utf8");
  console.log(
    `Шаблон ${professionId}: блоков ${template.rows.length}; источник ${resolved.source}; уже отмечено ${template.rows.filter((row) => row.existingMark).length}`,
  );
  console.log(`${base}.json`);
  console.log(`${base}.md`);
  console.log(priorityPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
