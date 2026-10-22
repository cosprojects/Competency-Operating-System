import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { CompetenciesFile } from "../model/types.ts";
import type { ProfessionView } from "../model/profession-view.ts";
import type { CompetencyBlock } from "../types.ts";
import { buildProfessionNetworkPage } from "../visualization/profession-network.ts";
import { renderCanvasPage } from "../visualization/page.ts";
import { flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const slug = flagValue(argv, "--profession") ?? "motion";
  const base = path.join(root, "src/methodology/v1/competency");
  const view = await readJson<ProfessionView>(path.join(base, "model/professions/views", `${slug}.json`));
  const competencies = await readJson<CompetenciesFile>(path.join(base, "model/competencies.json"));
  const catalog = await readJson<{ blocks: CompetencyBlock[] }>(path.join(base, "catalog/it.json")).catch(() => ({ blocks: [] }));
  const data = buildProfessionNetworkPage(view, competencies.competencies, catalog.blocks, new Date().toISOString().slice(0, 10));
  const output = path.join(root, "web", `it-${slug}-competency-canvas.html`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderCanvasPage(data, { activeProfession: slug }), "utf8");
  console.log(`${view.professionId}: nodes ${data.nodes.length}; edges ${data.edges.length}; tier ${data.counts.foundation}/${data.counts.core}/${data.counts.optional}`);
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
