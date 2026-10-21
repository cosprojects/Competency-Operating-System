import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { ProfessionView } from "../model/profession-view.ts";
import type { CompetenciesFile } from "../model/types.ts";
import { buildProfessionMapPageData, renderProfessionMapPage } from "../visualization/profession-page.ts";
import { flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const slug = flagValue(argv, "--profession") ?? "motion";
  const base = path.join(root, "src/methodology/v1/competency");
  const view = await readJson<ProfessionView>(path.join(base, "model/professions/views", `${slug}.json`));
  const competencies = await readJson<CompetenciesFile>(path.join(base, "model/competencies.json"));
  const data = buildProfessionMapPageData(view, competencies.competencies, new Date().toISOString().slice(0, 10));
  const output = path.join(root, "web", `it-${slug}-competency-map.html`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderProfessionMapPage(data), "utf8");
  console.log(`${data.professionId}: sections ${data.sections.length}; competencies ${data.sections.reduce((n, s) => n + s.competencies.length, 0)}; counts ${data.counts.foundation}/${data.counts.core}/${data.counts.optional}`);
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
