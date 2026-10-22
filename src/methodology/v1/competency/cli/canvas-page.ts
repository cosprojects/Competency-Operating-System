import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { StudyPriorityMark } from "../priority/types.ts";
import type { CanonicalMap } from "../canonical/types.ts";
import { professionIdOf, resolvePriorityBlocks, type PriorityBlockSource } from "../priority/source.ts";
import { layoutCompetencies } from "../canvas/layout.ts";
import { buildVisualizationPageData, renderCanvasPage } from "../visualization/page.ts";
import { buildCanonicalVisualization } from "../visualization/canonical.ts";
import type { VisualizationConfig } from "../visualization/types.ts";
import { dataDir, flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = professionIdOf(domain, profession);
  const slug = professionId.includes(".") ? professionId.slice(professionId.indexOf(".") + 1) : professionId;
  const resolved = await resolvePriorityBlocks({
    root,
    domain,
    profession,
    source: (flagValue(argv, "--source") as PriorityBlockSource | "auto" | undefined) ?? "auto",
    ...(flagValue(argv, "--blocks-file") ? { blocksFile: flagValue(argv, "--blocks-file")! } : {}),
    ...(argv.includes("--include-seed") ? { includeSeed: true } : {}),
  });
  const generatedOn = new Date().toISOString().slice(0, 10);
  const canonicalPath = path.join(root, "src/methodology/v1/competency/canonical", `${slug}.json`);
  const legacyConfigPath = flagValue(argv, "--visualization-file");
  let config: VisualizationConfig;
  let pageBlocks = resolved.blocks;
  let marks: StudyPriorityMark[];
  let coverageSuffix = "";
  if (legacyConfigPath) {
    config = await readJson<VisualizationConfig>(legacyConfigPath);
    marks = config.nodes.map((node) => ({
      competencyId: node.competencyId,
      tier: node.tier,
      order: node.order,
      prerequisites: node.prerequisites,
      rationale: node.shortDescription,
      confidence: "low",
      reviewer: "visual-draft",
      reviewedAt: generatedOn,
    }));
  } else {
    const canonical = await readJson<CanonicalMap>(canonicalPath);
    const built = buildCanonicalVisualization(canonical, resolved.blocks);
    config = built.config;
    pageBlocks = built.blocks;
    marks = built.marks;
    coverageSuffix = ` Покрытие: ${built.statusCounts.covered} covered / ${built.statusCounts.partial} partial / ${built.statusCounts.gap} gap.`;
  }
  const layout = layoutCompetencies({
    domain,
    professionId,
    blocks: pageBlocks,
    marks,
    viewport: { width: 1200, height: 800 },
    ...(legacyConfigPath ? { allowPartial: true } : {}),
  });
  const data = buildVisualizationPageData({
    layout,
    blocks: pageBlocks,
    config,
    generatedOn,
  });
  data.note = `${data.note}${coverageSuffix}`;
  const output =
    flagValue(argv, "--out") ??
    path.join(root, "web", "uxui-competency-canvas.html");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderCanvasPage(data, { activeProfession: slug }), "utf8");
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
