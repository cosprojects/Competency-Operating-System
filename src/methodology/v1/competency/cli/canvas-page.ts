import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { StudyPriorityMark } from "../priority/types.ts";
import { professionIdOf, resolvePriorityBlocks, type PriorityBlockSource } from "../priority/source.ts";
import { layoutCompetencies } from "../canvas/layout.ts";
import { buildVisualizationPageData, renderCanvasPage } from "../visualization/page.ts";
import type { VisualizationConfig } from "../visualization/types.ts";
import { dataDir, flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = professionIdOf(domain, profession);
  const slug = professionId.includes(".") ? professionId.slice(professionId.indexOf(".") + 1) : professionId;
  const configPath =
    flagValue(argv, "--visualization-file") ??
    path.join(root, "src/methodology/v1/competency/visualization", `${slug}.json`);
  const config = await readJson<VisualizationConfig>(configPath);
  const resolved = await resolvePriorityBlocks({
    root,
    domain,
    profession,
    source: (flagValue(argv, "--source") as PriorityBlockSource | "auto" | undefined) ?? "review",
    ...(flagValue(argv, "--blocks-file") ? { blocksFile: flagValue(argv, "--blocks-file")! } : {}),
    ...(argv.includes("--include-seed") ? { includeSeed: true } : {}),
  });
  const generatedOn = new Date().toISOString().slice(0, 10);
  const marks: StudyPriorityMark[] = config.nodes.map((node) => ({
    competencyId: node.competencyId,
    tier: node.tier,
    order: node.order,
    prerequisites: node.prerequisites,
    rationale: node.shortDescription,
    confidence: "low",
    reviewer: "visual-draft",
    reviewedAt: generatedOn,
  }));
  const layout = layoutCompetencies({
    domain,
    professionId,
    blocks: resolved.blocks,
    marks,
    viewport: { width: 1200, height: 800 },
  });
  const data = buildVisualizationPageData({
    layout,
    blocks: resolved.blocks,
    config,
    generatedOn,
  });
  const output =
    flagValue(argv, "--out") ??
    path.join(root, "web", "uxui-competency-canvas.html");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderCanvasPage(data), "utf8");
  console.log(
    `Страница ${professionId}: узлов ${data.nodes.length}; рёбер ${data.edges.length}; tier ${data.counts.foundation}/${data.counts.core}/${data.counts.optional}`,
  );
  console.log(output);
  console.log(dataDir(root));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
