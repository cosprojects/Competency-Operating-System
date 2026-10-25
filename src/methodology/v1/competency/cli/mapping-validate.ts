import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { CompetenciesFile } from "../model/types.ts";
import type { ProfessionView } from "../model/profession-view.ts";
import type { TagRecord } from "../types.ts";
import type { TagMappingFile } from "../mapping/types.ts";
import { renderTagMappingReport, validateTagMapping } from "../mapping/validate.ts";
import { dataDir, flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "product";
  const slug = profession.includes(".") ? profession.slice(profession.indexOf(".") + 1) : profession;
  const base = path.join(root, "src/methodology/v1/competency");
  const mappingPath = flagValue(argv, "--mapping-file") ?? path.join(base, "mapping", `${domain}.${slug}.json`);
  const viewPath = flagValue(argv, "--view-file") ?? path.join(base, "model/professions/views", `${slug}.json`);
  const tagsPath = flagValue(argv, "--tags-file") ?? path.join(dataDir(root), `tags-${domain}-${slug}.json`);

  const mapping = await readJson<TagMappingFile>(mappingPath);
  const view = await readJson<ProfessionView>(viewPath);
  const competencies = await readJson<CompetenciesFile>(path.join(base, "model/competencies.json"));
  const tagsPayload = await readJson<{ tags: TagRecord[] }>(tagsPath).catch(() => undefined);
  const titles = Object.fromEntries(competencies.competencies.map((item) => [item.id, item.title]));

  const result = validateTagMapping({
    mapping,
    view,
    ...(tagsPayload ? { tags: tagsPayload.tags } : {}),
    titles,
  });

  console.log(
    `mapping:validate ${mapping.professionId}: компетенций ${result.coverage.competencies}; direct ${result.coverage.direct}; adjacent ${result.coverage.adjacent}; none ${result.coverage.none}; тегов ${new Set(result.usedTagTitles.map((title) => title.toLowerCase())).size}; без решения ${result.unaccountedTagTitles.length}; errors ${result.errors.length}`,
  );
  for (const warning of result.warnings) console.warn(`  warning: ${warning}`);
  for (const error of result.errors) console.error(`  ${error}`);

  if (argv.includes("--report")) {
    const reportPath = path.join(dataDir(root), `mapping-${domain}-${slug}.md`);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, renderTagMappingReport({ mapping, view, ...(tagsPayload ? { tags: tagsPayload.tags } : {}), titles }, result), "utf8");
    console.log(reportPath);
  }
  if (result.errors.length > 0) process.exit(1);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
