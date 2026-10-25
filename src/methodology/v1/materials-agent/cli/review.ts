import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { CompetenciesFile } from "../../competency/model/types.ts";
import type { ProfessionView } from "../../competency/model/profession-view.ts";
import { loadCatalog } from "../../competency/catalog.ts";
import type { MaterialQueueJournal } from "../queue.ts";
import { renderMaterialQueueReview, type ReviewCoverageContext } from "../review.ts";
import { flagValue, readJson } from "../../competency/cli/common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "motion";
  const slug = profession.includes(".") ? profession.slice(profession.indexOf(".") + 1) : profession;
  const input = flagValue(argv, "--journal") ?? path.join(root, "data/materials-agent", `${domain}-${slug}-queue.json`);
  const journal = JSON.parse(await readFile(input, "utf8")) as MaterialQueueJournal;
  const output = path.join(root, "data/materials-agent", `${domain}-${slug}-review.md`);

  const context = await buildCoverageContext(root, slug);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderMaterialQueueReview(journal, context), "utf8");
  console.log(`${journal.professionId}: review ${journal.totals.items} items; linked ${journal.totals.linked}`);
  if (context) console.log(`  competencies: ${context.competencies.length}`);
  console.log(output);
}

/** View и каталог дают покрытие по компетенциям профессии, а не только по блокам. */
async function buildCoverageContext(root: string, slug: string): Promise<ReviewCoverageContext | undefined> {
  try {
    const base = path.join(root, "src/methodology/v1/competency");
    const view = await readJson<ProfessionView>(path.join(base, "model/professions/views", `${slug}.json`));
    const competencies = await readJson<CompetenciesFile>(path.join(base, "model/competencies.json"));
    const catalog = await loadCatalog(root, "it");
    const titles = new Map(competencies.competencies.map((item) => [item.id, item.title]));
    const ids = view.sections.flatMap((section) => section.competencies.map((competency) => competency.competencyId));
    return {
      competencies: ids.map((competencyId) => ({ competencyId, title: titles.get(competencyId) ?? competencyId })),
      blocks: catalog.blocks,
    };
  } catch {
    return undefined;
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
