import path from "node:path";
import type { PriorityFile } from "../priority/types.ts";
import { layoutCompetencies } from "../canvas/layout.ts";
import { professionIdOf, professionSlugOf, resolvePriorityBlocks, type PriorityBlockSource } from "../priority/source.ts";
import { dataDir, flagValue, readJson, writeJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = professionIdOf(domain, profession);
  const slug = professionSlugOf(professionId);
  const priorityPath =
    flagValue(argv, "--priority-file") ??
    path.join(root, "src/methodology/v1/competency/priority", `${slug}.json`);
  const priority = await readJson<PriorityFile>(priorityPath);
  const resolved = await resolvePriorityBlocks({
    root,
    domain,
    profession,
    source: (flagValue(argv, "--source") as PriorityBlockSource | "auto" | undefined) ?? "auto",
    ...(flagValue(argv, "--blocks-file") ? { blocksFile: flagValue(argv, "--blocks-file")! } : {}),
    ...(argv.includes("--include-seed") ? { includeSeed: true } : {}),
  });
  const width = Number(flagValue(argv, "--width") ?? 1200);
  const height = Number(flagValue(argv, "--height") ?? 800);
  const layout = layoutCompetencies({
    domain,
    professionId,
    blocks: resolved.blocks,
    marks: priority.marks,
    viewport: { width: Number.isFinite(width) && width > 0 ? width : 1200, height: Number.isFinite(height) && height > 0 ? height : 800 },
    ...(argv.includes("--allow-partial") ? { allowPartial: true } : {}),
  });
  const output = flagValue(argv, "--out") ?? path.join(dataDir(root), "canvas", `${domain}-${slug}.json`);
  await writeJson(output, {
    ...layout,
    generatedOn: new Date().toISOString().slice(0, 10),
    source: { kind: resolved.source, files: resolved.files },
    priorityFile: priorityPath,
  });
  console.log(
    `Канвас ${professionId}: узлов ${layout.nodes.length}; рёбер ${layout.edges.length}; диагностик ${layout.diagnostics.length}`,
  );
  for (const diagnostic of layout.diagnostics) console.log(`  ${diagnostic}`);
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
